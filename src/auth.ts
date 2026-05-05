import NextAuth from 'next-auth'
import Google from 'next-auth/providers/google'
import { createServiceClient } from '@/lib/supabase/server'

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
          .select('id, company_id, full_name, role, section_id, department_id')
          .eq('email', user.email)
          .single()
        if (emp) {
          token.employeeId = emp.id
          token.companyId = emp.company_id
          token.fullName = emp.full_name
          token.role = emp.role
          token.sectionId = emp.section_id
          token.departmentId = emp.department_id
        }
      }
      return token
    },
    async session({ session, token }) {
      session.user.employeeId = token.employeeId as string
      session.user.companyId = token.companyId as string
      session.user.fullName = token.fullName as string
      session.user.role = token.role as string
      session.user.sectionId = token.sectionId as string
      session.user.departmentId = token.departmentId as string
      return session
    },
  },
})
