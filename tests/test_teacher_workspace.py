"""教师工作台数据契约：使用独立 SQLite，不启动网络服务。"""
import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(__file__)), 'app'))
from ai4en import api, db, seed


class TeacherWorkspaceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.old_path = db.DB_PATH
        db.DB_PATH = os.path.join(self.temp.name, 'test.db')
        db.init()
        seed.run()
        self.teacher = db.query_one("SELECT * FROM users WHERE username = 't_wang'")
        self.other = db.query_one("SELECT * FROM users WHERE username = 't_li'")
        self.lesson = db.query_one("SELECT * FROM lessons WHERE topic = 'Animals'")

    def tearDown(self):
        db.DB_PATH = self.old_path
        self.temp.cleanup()

    def request(self, path, user=None, method='GET', body=None):
        return api.dispatch(method, path, {}, body or {}, user)

    def test_overview_counts_live_work_and_excludes_drafts(self):
        status, data = self.request('/api/teacher/overview', self.teacher)
        self.assertEqual(status, 200)
        self.assertEqual(data['stats'], {
            'lessons': 2, 'ongoing_tasks': 1, 'pending_review': 2,
            'revision_requested': 0, 'not_submitted': 2,
        })
        task = data['tasks'][0]
        self.assertEqual(task['submitted'], 4)
        self.assertEqual(len(task['not_submitted']), 2)
        sid = db.query_one("SELECT id FROM submissions WHERE status = 'submitted'")['id']
        db.execute("UPDATE submissions SET status = 'revision_requested' WHERE id = ?", (sid,))
        db.execute("UPDATE tasks SET status = 'draft'")
        _, hidden = self.request('/api/teacher/overview', self.teacher)
        self.assertEqual(hidden['tasks'], [])
        self.assertEqual(hidden['stats']['not_submitted'], 0)
        self.assertEqual(hidden['stats']['pending_review'], 0)

    def test_ended_tasks_keep_review_but_no_chasing_students(self):
        db.execute("UPDATE tasks SET status = 'ended'")
        db.execute("UPDATE submissions SET status = 'revision_requested' WHERE id = (SELECT MIN(id) FROM submissions)")
        _, data = self.request('/api/teacher/overview', self.teacher)
        self.assertEqual(data['stats']['ongoing_tasks'], 0)
        self.assertEqual(data['stats']['not_submitted'], 0)
        self.assertEqual(data['stats']['pending_review'], 2)
        self.assertEqual(data['stats']['revision_requested'], 1)

    def test_overview_is_scoped_to_teacher_and_denies_other_roles(self):
        _, other = self.request('/api/teacher/overview', self.other)
        self.assertEqual(other['stats']['lessons'], 0)
        self.assertEqual(other['tasks'], [])
        for username in [None, 's_zhang', 'p_zhang']:
            user = db.query_one('SELECT * FROM users WHERE username = ?', (username,)) if username else None
            with self.assertRaises(api.ApiError) as error:
                self.request('/api/teacher/overview', user)
            self.assertEqual(error.exception.status, 403 if user else 401)

    def test_observation_can_be_recorded_before_any_task(self):
        lesson = db.query_one("SELECT * FROM lessons WHERE topic = 'My Family'")
        student = db.query_one("SELECT * FROM users WHERE username = 's_zhang'")
        path = '/api/lessons/%s/observations' % lesson['id']
        status, _ = self.request(path, self.teacher, 'POST', {
            'student_id': student['id'], 'kind': 'oral', 'result': '需要提示', 'note': '补充句型提示',
        })
        self.assertEqual(status, 200)
        _, data = self.request(path, self.teacher)
        self.assertEqual(data['observations'][0]['note'], '补充句型提示')
        self.assertIsNone(data['observations'][0]['task_id'])
        self.assertEqual(len(data['students']), 6)
        with self.assertRaises(api.ApiError) as error:
            self.request(path, self.other)
        self.assertEqual(error.exception.status, 403)
        for body in [
            {'student_id': self.other['id'], 'result': '独立完成'},
            {'student_id': student['id'], 'kind': 'score', 'result': '独立完成'},
            {'student_id': student['id'], 'result': '100分'},
        ]:
            with self.assertRaises(api.ApiError) as error:
                self.request(path, self.teacher, 'POST', body)
            self.assertEqual(error.exception.status, 400)

    def test_lesson_observation_is_visible_in_student_review(self):
        student = db.query_one("SELECT * FROM users WHERE username = 's_zhang'")
        path = '/api/lessons/%s/observations' % self.lesson['id']
        self.request(path, self.teacher, 'POST', {
            'student_id': student['id'], 'kind': 'oral', 'result': '独立完成', 'note': '课内独立问答',
        })
        sub = db.query_one('SELECT id FROM submissions WHERE student_id = ?', (student['id'],))
        _, review = self.request('/api/submissions/%s/review' % sub['id'], self.teacher)
        self.assertIn('课内独立问答', [row['note'] for row in review['observations']])


if __name__ == '__main__':
    unittest.main()
