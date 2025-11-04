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

// Fetch role of a single user
const fetchUserRole = async (email: string): Promise<string> => {
    try {
        const response = await apiRequest<{ success: boolean; email: string; role: string }>(
            "GET",
            `/api/get-role?email=${encodeURIComponent(email)}`
        )
        return response.role || "user"
    } catch (error) {
        console.error(`Failed to fetch role for ${email}:`, error)
        return "user"
    }
}

// Fetch users filtered by status and enrich with role
const fetchUsers = async (status: string): Promise<User[]> => {
    const queryParam = status === "All" ? "" : `?status_filter=${encodeURIComponent(status)}`

    try {
        const res = await apiRequest<User[] | { users: User[] }>(
            "GET",
            `/api/admin/users${queryParam}`
        )

        const rawUsers = Array.isArray(res) ? res : res?.users || []

        // Attach role to each user
        return await Promise.all(
            rawUsers.map(async (user: User) => ({
                ...user,
                role: await fetchUserRole(user.email),
            }))
        )
    } catch (err) {
        console.error("Failed to fetch users:", err)
        return []
    }
}

// Fetch all users (used for metrics only)
const fetchAllUsers = async (): Promise<User[]> => {
    try {
        const res = await apiRequest<{ success: boolean; count: number; users: User[] }>(
            "GET",
            "/api/all-users"
        )

        if (!res.users || !Array.isArray(res.users)) {
            throw new Error("Invalid response format")
        }

        return res.users
    } catch (error) {
        console.error("Error fetching all users:", error)
        throw new Error("Failed to fetch all users")
    }
}

// Update user role
const UpdateUserRole = async (email: string, role: string) => {
    const data = await apiRequest("PUT", `/api/update-user-role`, {
        email,
        new_role: role,
    })
    console.log("User role response:", data)
    return data
}

/* ----------------------- Admin Dashboard ----------------------- */

export default function AdminDashboard() {
    const [_, navigate] = useLocation()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    /* --------------------- Local State --------------------- */
    const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
    const [isAuthLoading, setIsAuthLoading] = useState(true)
    const [searchQuery, setSearchQuery] = useState("")
    const [filteredUsers, setFilteredUsers] = useState<User[]>([])
    const [roleUpdates, setRoleUpdates] = useState<{ [email: string]: string }>({})
    const [role, setRole] = useState<string>("user") // current logged-in role
    const [statusFilter, setStatusFilter] = useState<string>("All")

    /* ------------------- Auth & Role Check ------------------- */
    useEffect(() => {
        const checkAdminAccess = async () => {
            try {
                const email = sessionStorage.getItem("signupEmail") || ""
                const res = await apiRequest<{ success: boolean; email: string; role: string }>(
                    "GET",
                    `/api/get-role?email=${encodeURIComponent(email)}`
                )

                // Restrict access to superadmins only
                if (res?.role !== "superadmin") {
                    toast({
                        title: "Access Denied",
                        description: "You don't have permission to access the super admin dashboard.",
                        variant: "destructive",
                    })
                    navigate("/home")
                    return
                }

                setCurrentUser({
                    is_admin: res.role === "superadmin",
                    name: res.email,
                })

                setRole(res.role || "user")
            } catch (err) {
                console.error("Auth check failed:", err)
                // fallback in case of error
                setCurrentUser({ is_admin: true, name: "Admin" })
            } finally {
                setIsAuthLoading(false)
            }
        }

        checkAdminAccess()
    }, [navigate, toast])

    /* ------------------- React Query ------------------- */

    // Fetch all users (for metrics)
    const {
        data: allUsers,
        isLoading: allUsersLoading,
        error: allUsersError,
    } = useQuery({
        queryKey: ["admin-all-users"],
        queryFn: fetchAllUsers,
        enabled: !!currentUser,
    })

    // Fetch users (for display, filtered)
    const {
        data: filteredUsersData,
        isLoading: filteredUsersLoading,
        error: filteredUsersError,
    } = useQuery({
        queryKey: ["admin-filtered-users", statusFilter],
        queryFn: () => fetchUsers(statusFilter),
        enabled: !!currentUser,
    })

    /* ------------------- Derived Values ------------------- */

    // Metrics: total users, admins, superadmins
    const metrics: DashboardMetrics = useMemo(() => {
        if (!allUsers) return { totalUsers: 0, admin: 0, superadmin: 0 }

        return {
            totalUsers: allUsers.length,
            admin: allUsers.filter(user => user.role === "admin").length,
            superadmin: allUsers.filter(user => user.role === "superadmin").length,
        }
    }, [allUsers])

    const users: User[] = filteredUsersData || []

    /* ------------------- Search Filter ------------------- */
    useEffect(() => {
        const query = searchQuery.toLowerCase()
        if (!query.trim()) {
            setFilteredUsers(users)
        } else {
            setFilteredUsers(
                users.filter(user =>
                    [user.name, user.email].some(field =>
                        field.toLowerCase().includes(query)
                    )
                )
            )
        }
    }, [searchQuery, users])

    /* ------------------- Role Update Mutation ------------------- */
    const roleUpdateMutation = useMutation({
        mutationFn: ({ email, role }: { email: string; role: string }) => UpdateUserRole(email, role),
        onSuccess: (_, variables) => {
            toast({
                title: "Success",
                description: `User ${variables.email} has been updated to ${variables.role}.`,
            })
            // Refresh data
            queryClient.invalidateQueries({ queryKey: ["admin-all-users"] })
            queryClient.invalidateQueries({ queryKey: ["admin-filtered-users"] })
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to update user role. Please try again.",
                variant: "destructive",
            })
        },
    })

    /* ------------------- Conditional Render ------------------- */
    if (isAuthLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="flex items-center space-x-2">
                    <Loader2 className="h-6 w-6 animate-spin" />
                    <span>Checking permissions...</span>
                </div>
            </div>
        )
    }

    if (!currentUser) return null

    const isLoading = allUsersLoading || filteredUsersLoading

    /* ------------------- UI ------------------- */
    return (
        <div className="flex min-h-screen bg-neutral-50 dark:bg-[#2d3139]">
            <Sidebar />
            <div className="flex-1 md:ml-[14rem]">
                <Header />
                <Lowheader />

                <div className="container mx-auto p-6 space-y-6">
                    {/* Page Title */}
                    <div className="flex items-center justify-between">
                        <h1 className="text-2xl font-semibold">User Access Control</h1>
                    </div>

                    {/* Dashboard Metrics */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Card>
                            <CardHeader className="flex flex-row justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                                <Users className="h-4 w-4 text-blue-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{metrics.totalUsers}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Admin</CardTitle>
                                <UserCheck className="h-4 w-4 text-green-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-green-600">{metrics.admin}</div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row justify-between pb-2">
                                <CardTitle className="text-sm font-medium">Super Admin</CardTitle>
                                <UserCheck className="h-4 w-4 text-purple-600" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-purple-600">{metrics.superadmin}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* User Table & Management */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Manage User Access</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {/* Search Bar */}
                            <div className="flex flex-col sm:flex-row gap-4 mb-6 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search by name, email..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>

                            {/* User Table */}
                            <div className="border rounded-lg">
                                {isLoading ? (
                                    <div className="flex justify-center py-12">
                                        <Loader2 className="h-6 w-6 animate-spin mr-2" />
                                        <span>Loading users...</span>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-medium mb-2">No users found</h3>
                                        <p className="text-muted-foreground">
                                            {searchQuery
                                                ? "Try adjusting your search criteria."
                                                : "No users match the current filter."}
                                        </p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
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
                                                <TableRow key={user.email}>
                                                    <TableCell className="font-medium">{user.name}</TableCell>
                                                    <TableCell>{user.email}</TableCell>
                                                    <TableCell>
                                                        <span
                                                            className={`items-center text-center px-2 py-1 rounded-full text-xs font-medium ${user.role === "superadmin"
                                                                ? "bg-purple-100 text-purple-800"
                                                                : user.role === "admin"
                                                                    ? "bg-green-100 text-green-800"
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
                                                            <SelectTrigger className="w-[140px]">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                            <SelectContent>
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
                                                            disabled={
                                                                roleUpdateMutation.isPending &&
                                                                roleUpdateMutation.variables?.email === user.email
                                                            }
                                                            className="bg-blue-600 hover:bg-blue-700"
                                                        >
                                                            {roleUpdateMutation.isPending &&
                                                                roleUpdateMutation.variables?.email === user.email ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
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
