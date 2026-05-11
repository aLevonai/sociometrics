import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { createServiceClient } from '@/lib/supabase/server'
import type { EmployeeRole } from '@/types/next-auth'

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  pages: {
    signIn: '/login',
    error: '/login',
  },
  callbacks: {
    async signIn({ user }) {
      if (!user.email) return false
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('employees')
        .select('id')
        .eq('email', user.email)
        .maybeSingle()
      return !!data
    },
    async jwt({ token, user }) {
      if (user?.email) {
        const supabase = createServiceClient()
        const { data: emp } = await supabase
          .from('employees')
          .select('id, company_id, year_id, team_id, full_name, role')
          .eq('email', user.email)
          .single()
        if (emp) {
          token.employeeId = emp.id
          token.companyId = emp.company_id
          token.yearId = emp.year_id
          token.teamId = emp.team_id ?? null
          token.fullName = emp.full_name
          token.role = emp.role as EmployeeRole
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.employeeId = token.employeeId as string
      session.user.companyId = token.companyId as string
      session.user.yearId = token.yearId as string
      session.user.teamId = (token.teamId as string | null | undefined) ?? null
      session.user.fullName = token.fullName as string
      session.user.role = token.role as EmployeeRole
      return session
    },
  },
})
