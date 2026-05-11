import type { DefaultSession } from 'next-auth'

export type EmployeeRole =
  | 'soldier'
  | 'team_leader'
  | 'company_commander'
  | 'year_commander'
  | 'super_commander'

declare module 'next-auth' {
  interface Session {
    user: {
      employeeId: string
      companyId: string
      yearId: string
      teamId: string | null
      fullName: string
      role: EmployeeRole
    } & DefaultSession['user']
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    employeeId?: string
    companyId?: string
    yearId?: string
    teamId?: string | null
    fullName?: string
    role?: EmployeeRole
  }
}
