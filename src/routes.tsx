import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { AdminClosuresPage } from '@/admin/AdminClosuresPage'
import { AdminEnrollmentsPage } from '@/admin/AdminEnrollmentsPage'
import { AdminSettingsPage } from '@/admin/AdminSettingsPage'
import {
  AdmissionGate,
  LoginRoute,
  RequireAuth,
  RequireRole,
  RoleHome,
} from '@/auth/guards'
import { CourseDetailPage } from '@/courses/CourseDetailPage'
import { CoursesPage } from '@/courses/CoursesPage'
import { MyEnrollmentsPage } from '@/enrollments/MyEnrollmentsPage'
import { AppLayout } from '@/layout/AppLayout'
import { ProfessorCoursesPage } from '@/professor/ProfessorCoursesPage'

// 라우트 트리(설계 3.3절). 학생 경로는 AdmissionGate로 감싼다(계획 2.2).
export const routes: RouteObject[] = [
  { path: '/login', Component: LoginRoute },
  {
    Component: RequireAuth,
    children: [
      {
        Component: AppLayout,
        children: [
          { path: '/', Component: RoleHome },
          {
            Component: AdmissionGate,
            children: [
              { path: '/courses', Component: CoursesPage },
              { path: '/courses/:courseCode', Component: CourseDetailPage },
            ],
          },
          {
            element: <RequireRole roles={['STUDENT']} />,
            children: [
              {
                Component: AdmissionGate,
                children: [{ path: '/me/enrollments', Component: MyEnrollmentsPage }],
              },
            ],
          },
          {
            element: <RequireRole roles={['PROFESSOR']} />,
            children: [{ path: '/professor/courses', Component: ProfessorCoursesPage }],
          },
          {
            element: <RequireRole roles={['ADMIN']} />,
            children: [
              { path: '/admin/enrollments', Component: AdminEnrollmentsPage },
              { path: '/admin/settings', Component: AdminSettingsPage },
              { path: '/admin/closures', Component: AdminClosuresPage },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
]

export const router = createBrowserRouter(routes)
