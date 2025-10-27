import { useEffect, useState, useMemo } from "react"
import { useLocation } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Search, Users, UserCheck } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Lowheader from "@/components/Lowheader"
import Sidebar from "@/components/Sidebar"
import Header from "@/components/Header"
import { apiRequest } from "@/lib/queryClient"

/* ----------------------------- Types ----------------------------- */
interface User {
  name: string
  email: string
  role: string
}

interface AdminUser {
  is_admin: boolean
  name: string
}

interface DashboardMetrics {
  totalUsers: number
  admin: number
  superadmin: number
}

/* -------------------------- API Helpers -------------------------- */

const demoUsers: User[] = [
  { name: "Alice Johnson", email: "alice@example.com", role: "admin" },
  { name: "Bob Smith", email: "bob@example.com", role: "user" },
  { name: "Clara White", email: "clara@example.com", role: "superadmin" },
  { name: "David Brown", email: "david@example.com", role: "user" },
]

const fetchAllUsers = async (): Promise<User[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(demoUsers), 500))
}

const fetchUsers = async (): Promise<User[]> => {
  return new Promise((resolve) => setTimeout(() => resolve(demoUsers), 500))
}

const UpdateUserRole = async (email: string, role: string) => {
  console.log(`Updated ${email} to ${role}`)
  return { success: true }
}

/* ----------------------- Admin Dashboard ----------------------- */

export default function AdminDashboard() {
  const [_, navigate] = useLocation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [currentUser, setCurrentUser] = useState<AdminUser | null>({
    is_admin: true,
    name: "Super Admin",
  })
  const [searchQuery, setSearchQuery] = useState("")
  const [filteredUsers, setFilteredUsers] = useState<User[]>([])
  const [roleUpdates, setRoleUpdates] = useState<{ [email: string]: string }>({})

  const { data: allUsers, isLoading: allUsersLoading } = useQuery({
    queryKey: ["admin-all-users"],
    queryFn: fetchAllUsers,
    enabled: !!currentUser,
  })

  const { data: filteredUsersData, isLoading: filteredUsersLoading } = useQuery({
    queryKey: ["admin-filtered-users"],
    queryFn: fetchUsers,
    enabled: !!currentUser,
  })

  const metrics: DashboardMetrics = useMemo(() => {
    if (!allUsers) return { totalUsers: 0, admin: 0, superadmin: 0 }

    return {
      totalUsers: allUsers.length,
      admin: allUsers.filter((user) => user.role === "admin").length,
      superadmin: allUsers.filter((user) => user.role === "superadmin").length,
    }
  }, [allUsers])

  const users: User[] = filteredUsersData || []

  useEffect(() => {
    const query = searchQuery.toLowerCase()
    if (!query.trim()) {
      setFilteredUsers(users)
    } else {
      setFilteredUsers(
        users.filter((user) =>
          [user.name, user.email].some((field) => field.toLowerCase().includes(query))
        )
      )
    }
  }, [searchQuery, users])

  const roleUpdateMutation = useMutation({
    mutationFn: ({ email, role }: { email: string; role: string }) => UpdateUserRole(email, role),
    onSuccess: (_, variables) => {
      toast({
        title: "Success",
        description: `User ${variables.email} updated to ${variables.role}.`,
      })
      queryClient.invalidateQueries({ queryKey: ["admin-all-users"] })
      queryClient.invalidateQueries({ queryKey: ["admin-filtered-users"] })
    },
  })

  const isLoading = allUsersLoading || filteredUsersLoading

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      <div className="flex-1 md:ml-[14rem]">
        <Header />
        <Lowheader />

        <div className="container mx-auto p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold text-foreground">User Access Control</h1>
          </div>

          {/* Dashboard Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-0 bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] text-white">
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                <Users className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.totalUsers}</div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] text-white">
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm font-medium">Admin</CardTitle>
                <UserCheck className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.admin}</div>
              </CardContent>
            </Card>

            <Card className="border-0 bg-gradient-to-r from-[#06a57f] via-[#05b289] to-[#05b288] text-white">
              <CardHeader className="flex flex-row justify-between pb-2">
                <CardTitle className="text-sm font-medium">Super Admin</CardTitle>
                <UserCheck className="h-4 w-4" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.superadmin}</div>
              </CardContent>
            </Card>
          </div>

          {/* User Table */}
          <Card className="border-0 shadow-md bg-card text-foreground">
            <CardHeader>
              <CardTitle>Manage User Access</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background text-foreground"
                />
              </div>

              <div className="border rounded-lg bg-background">
                {isLoading ? (
                  <div className="flex justify-center py-12 text-muted-foreground">
                    <Loader2 className="h-6 w-6 animate-spin mr-2 text-[#05b289]" />
                    Loading users...
                  </div>
                ) : filteredUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <Users className="h-12 w-12 mb-4 text-[#05b289]" />
                    <h3 className="text-lg font-medium">No users found</h3>
                    <p>Try adjusting your search criteria.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader className="bg-background text-foreground">
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Current Role</TableHead>
                        <TableHead>Update Role</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredUsers.map((user) => (
                        <TableRow key={user.email} className="bg-background hover:bg-muted transition-colors">
                          <TableCell className="font-medium">{user.name}</TableCell>
                          <TableCell>{user.email}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                user.role === "superadmin"
                                  ? "bg-[#e8f5ff] text-[#5168ff]"
                                  : user.role === "admin"
                                  ? "bg-[#e6f9f3] text-[#02b589]"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {user.role === "superadmin"
                                ? "Super Admin"
                                : user.role === "admin"
                                ? "Admin"
                                : "User"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Select
                              value={roleUpdates[user.email] || user.role}
                              onValueChange={(newRole) =>
                                setRoleUpdates((prev) => ({
                                  ...prev,
                                  [user.email]: newRole,
                                }))
                              }
                            >
                              <SelectTrigger className="w-[140px] border-gray-300 bg-background text-foreground hover:bg-muted transition-colors">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="bg-background text-foreground">
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="superadmin">Super Admin</SelectItem>
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              onClick={() =>
                                roleUpdateMutation.mutate({
                                  email: user.email,
                                  role: roleUpdates[user.email] || user.role,
                                })
                              }
                              className="bg-white text-[#02b589] border border-[#02b589] hover:bg-[#02b589] hover:text-white transition-colors"
                            >
                              {roleUpdateMutation.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin text-[#02b589]" />
                              ) : (
                                "Update"
                              )}
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
