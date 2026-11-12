import type { components, operations } from './schema'

export type Schemas = components['schemas']
export type OperationId = keyof operations

export type AuthenticatedUser = Schemas['AuthenticatedUser']
export type SessionState = Schemas['SessionState']
export type TokenResponse = Schemas['TokenResponse']
export type LoginRequest = Schemas['LoginRequest']
export type UserRole = Schemas['UserRole']

export type Ticket = Schemas['Ticket']
export type TicketStatus = Schemas['TicketStatus']
export type TicketRequestType = Schemas['TicketRequestType']
export type TicketResultCode = Schemas['TicketResultCode']
export type LoginTicketReceipt = Schemas['LoginTicketReceipt']
export type TicketReceipt = Schemas['TicketReceipt']
export type AdmissionState = Schemas['AdmissionState']

export type ProblemDetails = Schemas['ProblemDetails']
export type ProblemCode = Schemas['ProblemCode']
export type AuthFailureReason = Schemas['AuthFailureReason']
export type FieldViolation = Schemas['FieldViolation']

export type Course = Schemas['Course']
export type CoursePage = Schemas['CoursePage']
export type CourseList = Schemas['CourseList']
export type CourseCategory = Schemas['CourseCategory']
export type CourseCategoryFilter = Schemas['CourseCategoryFilter']
export type EvaluationType = Schemas['EvaluationType']
export type CourseStatus = Schemas['CourseStatus']
export type CourseCreateRequest = Schemas['CourseCreateRequest']
export type CourseUpdateRequest = Schemas['CourseUpdateRequest']
export type CourseClosureResult = Schemas['CourseClosureResult']

export type MyEnrollment = Schemas['MyEnrollment']
export type MyEnrollmentList = Schemas['MyEnrollmentList']
export type EnrollmentType = Schemas['EnrollmentType']

export type AdminEnrollmentRequest = Schemas['AdminEnrollmentRequest']
export type AdminEnrollmentResult = Schemas['AdminEnrollmentResult']

export type ServiceSettings = Schemas['ServiceSettings']
export type ServiceSettingsUpdateRequest = Schemas['ServiceSettingsUpdateRequest']

export type ClosureCandidate = Schemas['ClosureCandidate']
export type ClosureCandidatePage = Schemas['ClosureCandidatePage']
export type CourseClosureBatchResult = Schemas['CourseClosureBatchResult']
export type CourseClosureItemResult = Schemas['CourseClosureItemResult']
export type CourseClosureItemCode = Schemas['CourseClosureItemCode']
