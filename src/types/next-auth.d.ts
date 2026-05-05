import type { DefaultSession } from 'next-auth'

declare module 'next-auth' {
  interface Session {
    user: {
      employeeId: string
      companyId: string
      fullName: string
      role: string
      sectionId: string
      departmentId: string
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    employeeId?: string
    companyId?: string
    fullName?: string
    role?: string
    sectionId?: string
    departmentId?: string
  }
}
