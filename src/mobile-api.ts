import type { User } from '@react-native-firebase/auth';

const DEFAULT_API_URL = 'https://toptech-900622238331.us-east4.run.app';

export const API_URL = (
  process.env.EXPO_PUBLIC_API_URL?.trim() || DEFAULT_API_URL
).replace(/\/$/, '');

export type InstructorProfile = {
  id: string;
  employeeNumber: string;
  instructorType: 'THEORY' | 'PRACTICAL' | 'BOTH';
  employmentStatus: 'ACTIVE';
  firstName: string;
  lastName: string;
  phoneNumber: string | null;
  branch: {
    id: string;
    code: string;
    name: string;
  } | null;
};

export type AssignedStudent = {
  assignmentId: string;
  assignmentType: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  enrolmentId: string;
  enrolmentStatus: string;
  student: {
    id: string;
    studentNumber: string;
    firstName: string;
    lastName: string;
    phoneNumber: string | null;
    trainingStatus: string;
  };
  course: {
    code: string;
    name: string;
  };
  cohort: {
    id: string;
    name: string;
  } | null;
};

type ApiErrorBody = {
  code?: string;
  error?: string;
};

export class MobileApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = 'MobileApiError';
  }
}

async function request<T>(
  path: string,
  firebaseUser: User,
  init?: RequestInit,
): Promise<T> {
  const token = await firebaseUser.getIdToken();
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  const body = (await response.json().catch(() => ({}))) as T & ApiErrorBody;

  if (!response.ok) {
    throw new MobileApiError(
      body.error || 'TopTech could not complete this request.',
      response.status,
      body.code,
    );
  }

  return body;
}

export async function resolveInstructor(
  firebaseUser: User,
): Promise<void> {
  const result = await request<{ refreshToken: boolean }>(
    '/api/mobile/auth/resolve',
    firebaseUser,
    { method: 'POST' },
  );

  if (result.refreshToken) {
    await firebaseUser.getIdToken(true);
  }
}

export async function loadInstructorWorkspace(
  firebaseUser: User,
): Promise<{ profile: InstructorProfile; students: AssignedStudent[] }> {
  const [profileResult, studentResult] = await Promise.all([
    request<{ profile: InstructorProfile }>(
      '/api/mobile/instructor/me',
      firebaseUser,
    ),
    request<{ students: AssignedStudent[]; total: number }>(
      '/api/mobile/instructor/students',
      firebaseUser,
    ),
  ]);

  return {
    profile: profileResult.profile,
    students: studentResult.students,
  };
}
