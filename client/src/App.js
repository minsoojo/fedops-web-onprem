import React from 'react';
import { Routes, Route } from 'react-router-dom';
import MainPage from './pages/MainPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import TaskPage from './pages/TaskPage';
import CreatePage from './pages/CreatePage';
import TaskDetailPage from './pages/TaskDetailPage';
import ProtectedRoute from './components/route/ProtectedRoute';
import PublicTasksPage from './pages/PublicTasksPage';
import PublicTaskDetailPage from './pages/PublicTaskDetailPage';
import SharedTaskDetailPage from './pages/SharedTaskDetailPage';
import NewsPage from './pages/NewsPage';
import BlogPage from './pages/BlogPage';

const BlogwritePage = React.lazy(() => import('./pages/BlogwritePage'));
const BlogEditPage = React.lazy(() => import('./pages/BlogEditPage'));
const EditorialDetailPage = React.lazy(
  () => import('./components/editorial/EditorialDetailPage'),
);

const LazyRoute = ({ children }) => (
  <React.Suspense
    fallback={(
      <div
        role="status"
        style={{
          minHeight: '50vh',
          display: 'grid',
          placeItems: 'center',
          color: '#6f6a66',
        }}
      >
        Loading…
      </div>
    )}
  >
    {children}
  </React.Suspense>
);

const RedirectToExternal = ({ url }) => {
  React.useEffect(() => {
    window.location.href = url;
  }, [url]);

  return null; // 리다이렉트 처리 후 컴포넌트 자체는 렌더링되지 않음
};

const App = () => {
  return (
    <Routes>
      {/* '/' 경로에 접근 시 연구실 홈페이지로 리다이렉트 */}
      <Route path="/" element={<RedirectToExternal url="https://sites.google.com/view/keylee" />} />

      {/* 기본 '/' 경로에 접근 시 '/fedops'로 리다이렉트 */}
      {/* <Route path="/" element={<Navigate to="/fedops" />} /> */}


      {/* 내부 라우트 설정 */}
      {/* <Route path="/fedops" element={<MainPage />} /> */}
      <Route path="/fedops" element={<MainPage />} />
      <Route path="/fedops/login" element={<LoginPage />} />
      <Route path="/fedops/register" element={<RegisterPage />} />
      <Route path="/fedops/registry" element={<PublicTasksPage />} />
      <Route path="/fedops/registry/:handle/:slug" element={<PublicTaskDetailPage />} />
      {/* Backward-compatible routes for previously shared Public Tasks URLs. */}
      <Route path="/fedops/tasks" element={<PublicTasksPage />} />
      <Route path="/fedops/tasks/:handle/:slug" element={<PublicTaskDetailPage />} />
      <Route path="/fedops/news" element={<NewsPage />} />
      <Route
        path="/fedops/news/:id"
        element={<LazyRoute><EditorialDetailPage kind="news" /></LazyRoute>}
      />
      <Route path="/fedops/blog" element={<BlogPage />} />
      <Route
        path="/fedops/blog/:id"
        element={<LazyRoute><EditorialDetailPage kind="blog" /></LazyRoute>}
      />
      <Route
        path="/fedops/newswrite"
        element={(
          <LazyRoute>
            <ProtectedRoute component={BlogwritePage} />
          </LazyRoute>
        )}
      />
      <Route
        path="/fedops/blogwrite"
        element={(
          <LazyRoute>
            <ProtectedRoute component={BlogwritePage} />
          </LazyRoute>
        )}
      />
      <Route
        path="/fedops/news/edit/:id"
        element={(
          <LazyRoute>
            <ProtectedRoute component={BlogEditPage} />
          </LazyRoute>
        )}
      />
      <Route
        path="/fedops/blog/edit/:id"
        element={(
          <LazyRoute>
            <ProtectedRoute component={BlogEditPage} />
          </LazyRoute>
        )}
      />
      <Route
        path="/fedops/shared/:title"
        element={<ProtectedRoute component={SharedTaskDetailPage} />}
      />
      <Route path="/fedops/task" element={<TaskPage />} />
      <Route
        path="/fedops/task/create"
        element={<ProtectedRoute component={CreatePage} />}
      />
      <Route
        path="/fedops/task/:title/*"
        element={<ProtectedRoute component={TaskDetailPage} />}
      />
    </Routes>
  );
};

export default App;
