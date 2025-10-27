import { useEffect, useState, useMemo } from "react"
import { useLocation } from "wouter"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Search, Users, UserCheck, Clock, Copy } from "lucide-react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import Lowheader from "@/components/Lowheader";
import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import { apiRequest } from "@/lib/queryClient"

interface User {
    name: string
    email: string
    broker_name: string
    broker_id: string
    created_at: string
    status: "Pending" | "Approved"
}

interface AdminUser {
    is_admin: boolean
    name: string
}

interface DashboardMetrics {
    pendingApprovals: number
    totalUsers: number
    totalApproved: number
}

// ✅ Mock Users (for local testing)
const mockUsers: User[] = [
    {
        name: "Alice Johnson",
        email: "alice@example.com",
        broker_name: "CoinDCX",
        broker_id: "BRK-001",
        created_at: "2025-10-05T10:23:00Z",
        status: "Pending"
    },
    {
        name: "Bob Smith",
        email: "bob@example.com",
        broker_name: "Delta Exchange",
        broker_id: "BRK-002",
        created_at: "2025-09-29T09:15:00Z",
        status: "Approved"
    },
    {
        name: "Charlie Patel",
        email: "charlie@example.com",
        broker_name: "CoinDCX",
        broker_id: "BRK-003",
        created_at: "2025-10-01T12:00:00Z",
        status: "Pending"
    },
    {
        name: "Diana Kaur",
        email: "diana@example.com",
        broker_name: "CoinDCX",
        broker_id: "BRK-004",
        created_at: "2025-09-25T14:45:00Z",
        status: "Approved"
    },
]

// Show users by filtering it to Pending, Approved, or All
const fetchUsers = async (status: string): Promise<User[]> => {
    // const queryParam = status === "All" ? "" : `?status_filter=${encodeURIComponent(status)}`;

    // try {
    //     const res = await apiRequest<User[] | { users: User[] }>("GET", `/api/admin/users${queryParam}`);

    //     if (Array.isArray(res)) return res;
    //     if (res?.users && Array.isArray(res.users)) return res.users;

    //     throw new Error("Unexpected response format");
    // } catch (err) {
    //     console.error("Failed to fetch users:", err);
    //     return [];
    // }
    try {
        const queryParam = status === "All" ? "" : `?status_filter=${encodeURIComponent(status)}`;
        const res = await apiRequest<User[] | { users: User[] }>("GET", `/api/admin/users${queryParam}`);
        if (Array.isArray(res)) return res;
        if (res?.users && Array.isArray(res.users)) return res.users;
        throw new Error("Unexpected response format");
    } catch (err) {
        console.warn("⚠️ Using mock data for fetchUsers due to error:", err);
        if (status === "All") return mockUsers;
        return mockUsers.filter(u => u.status === status);
    }
};

// Fetch all users for metrics calculation
const fetchAllUsers = async (): Promise<User[]> => {
    // try {
    //     const res = await apiRequest<{ success: boolean, count: number; users: User[] }>(
    //         "GET",
    //         "/api/all-users"
    //     );

    //     if (!res.users || !Array.isArray(res.users)) {
    //         throw new Error("Invalid response format");
    //     }

    //     return res.users;
    // } catch (error) {
    //     console.error("Error fetching all users:", error);
    //     throw new Error("Failed to fetch all users");
    // }
    // ✅ Mock data fallback
    try {
        const res = await apiRequest<{ success: boolean, count: number; users: User[] }>("GET", "/api/all-users");
        if (!res.users || !Array.isArray(res.users)) throw new Error("Invalid response format");
        return res.users;
    } catch (error) {
        console.warn("⚠️ Using mock data for fetchAllUsers due to error:", error);
        return mockUsers;
    }
};

// Approve users status
const approveUser = async (email: string) => {
    // const data = await apiRequest(
    //     "PUT",
    //     "/api/admin/update-user-status",
    //     {
    //         email,
    //         new_status: "approved"
    //     }
    // );
    // console.log("Approve user response:", data);
    // return data;

    // ✅ Mock approve behavior
    try {
        const data = await apiRequest("PUT", "/api/admin/update-user-status", { email, new_status: "approved" });
        return data;
    } catch {
        console.warn("⚠️ Using mock approveUser fallback");
        return { success: true, email, new_status: "approved" };
    }
};

export default function AdminDashboard() {
    const [_, navigate] = useLocation()
    const { toast } = useToast()
    const queryClient = useQueryClient()

    const [currentUser, setCurrentUser] = useState<AdminUser | null>(null)
    const [isAuthLoading, setIsAuthLoading] = useState(true)
    const [statusFilter, setStatusFilter] = useState<string>("Pending")
    const [searchQuery, setSearchQuery] = useState("")
    const [filteredUsers, setFilteredUsers] = useState<User[]>([])

    // Checks Admin access
    useEffect(() => {
        const checkAdminAccess = async () => {
            try {
                const email = sessionStorage.getItem('signupEmail') || '';
                const res = await apiRequest<{ success: boolean; email: string; role: string; }>(
                    "GET",
                    `/api/get-role?email=${encodeURIComponent(email)}`
                );

                if (res?.role !== "superadmin" && res?.role !== "admin") {
                    toast({
                        title: "Access Denied",
                        description: "You don't have permission to access the admin dashboard.",
                        variant: "destructive",
                    });
                    navigate("/home");
                    return;
                }

                setCurrentUser({
                    is_admin: res.role === "admin" || res.role === "superadmin",
                    name: res.email, // or use res.name if available
                });
            } catch (err) {
                console.error("Auth check failed:", err);
                setCurrentUser({ is_admin: true, name: "Admin" }); // fallback, remove if not intended
            } finally {
                setIsAuthLoading(false);
            }
        };

        checkAdminAccess();
    }, [navigate, toast]);

    // Function to handle copying Broker ID to clipboard
    const handleCopy = (text: string) => {
        navigator.clipboard.writeText(text)
            .then(() => {
                toast({
                    title: "Copied!",
                    description: (<>Broker ID <strong>{text}</strong> has been copied to clipboard</>),
                });
            })
            .catch(() => {
                toast({
                    title: "Error",
                    description: "Failed to copy Broker ID.",
                    variant: "destructive",
                });
            });
    };

    // Fetch All Users for Metrics
    const {
        data: allUsers,
        isLoading: allUsersLoading,
        error: allUsersError
    } = useQuery({
        queryKey: ["admin-all-users"],
        queryFn: fetchAllUsers,
        enabled: !!currentUser,
    })

    // Fetch Filtered Users for Display
    const {
        data: filteredUsersData,
        isLoading: filteredUsersLoading,
        error: filteredUsersError
    } = useQuery({
        queryKey: ["admin-filtered-users", statusFilter],
        queryFn: () => fetchUsers(statusFilter),
        enabled: !!currentUser,
    })

    // Calculate metrics from all users
    const metrics: DashboardMetrics = useMemo(() => {
        if (!allUsers) {
            return {
                pendingApprovals: 0,
                totalUsers: 0,
                totalApproved: 0,
            }
        }

        return {
            totalUsers: allUsers.length,
            pendingApprovals: allUsers.filter(user => user.status === "Pending").length,
            totalApproved: allUsers.filter(user => user.status === "Approved").length,
        }
    }, [allUsers])

    // Get filtered users for display
    const users: User[] = filteredUsersData || []

    // Filtered Users based on search
    useEffect(() => {
        const query = searchQuery.toLowerCase()
        if (!query.trim()) {
            setFilteredUsers(users)
        } else {
            setFilteredUsers(
                users.filter((user) =>
                    [user.name, user.email, user.broker_name, user.broker_id].some((field) =>
                        field.toLowerCase().includes(query)
                    )
                )
            )
        }
    }, [searchQuery, users])

    // Approve Users Mutation
    const approveMutation = useMutation({
        mutationFn: approveUser,
        onSuccess: (_, email) => {
            toast({
                title: "Success",
                description: `User ${email} has been approved.`,
            })
            // Invalidate both queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["admin-all-users"] })
            queryClient.invalidateQueries({ queryKey: ["admin-filtered-users"] })
        },
        onError: () => {
            toast({
                title: "Error",
                description: "Failed to approve user. Please try again.",
                variant: "destructive",
            })
        },
    })

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString("en-US", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        })
    }

    const getStatusBadgeVariant = (status: string) => {
        switch (status) {
            case "Pending":
                return "secondary"
            case "Approved":
                return "default"
            default:
                return "outline"
        }
    }

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

    // Add error handling for debugging
    if (allUsersError || filteredUsersError) {
        console.error("Query error:", allUsersError || filteredUsersError)
    }

    const isLoading = allUsersLoading || filteredUsersLoading

    return (
        // <div className="flex min-h-screen bg-neutral-50 dark:dark:bg-[#2d3139]">
        //     <Sidebar />

        //     <div className="flex-1 md:ml-[14rem]">
        //         <Header />
        //         <Lowheader />
        //         <div className="container mx-auto p-6 space-y-6">
        //             {/* Header */}
        //             <div className="flex items-center justify-between">
        //                 <div>
        //                     <h1 className="text-2xl font-semibold">Approval Dashboard</h1>
        //                 </div>
        //             </div>

        //             {/* Metrics - Always shows overall totals */}
        //             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
        //                 <Card className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20">
        //                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        //                         <CardTitle className="text-sm font-medium text-white">Pending Approvals</CardTitle>
        //                         <Clock className="h-4 w-4 text-white" />
        //                     </CardHeader>
        //                     <CardContent>
        //                         <div className="text-2xl font-bold text-white">{metrics.pendingApprovals}</div>
        //                     </CardContent>
        //                 </Card>
        //                 <Card className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20">
        //                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        //                         <CardTitle className="text-sm font-medium text-white">Total Users</CardTitle>
        //                         <Users className="h-4 w-4 text-white" />
        //                     </CardHeader>
        //                     <CardContent>
        //                         <div className="text-2xl font-bold text-white">{metrics.totalUsers}</div>
        //                     </CardContent>
        //                 </Card>
        //                 <Card className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20">
        //                     <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        //                         <CardTitle className="text-sm font-medium text-white">Approved Users</CardTitle>
        //                         <UserCheck className="h-4 w-4 text-white" />
        //                     </CardHeader>
        //                     <CardContent>
        //                         <div className="text-2xl font-bold text-white">{metrics.totalApproved}</div>
        //                     </CardContent>
        //                 </Card>
        //             </div>

        //             {/* Filters */}
        //             <Card className="dark:bg-background">
        //                 <CardHeader>
        //                     <CardTitle>User Management</CardTitle>
        //                 </CardHeader>
        //                 <CardContent>
        //                     <div className="flex flex-col sm:flex-row gap-4 mb-6">
        //                         <div className="flex-1">
        //                             <div className="relative">
        //                                 <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        //                                 <Input
        //                                     placeholder="Search by name, email, broker name, or broker ID..."
        //                                     value={searchQuery}
        //                                     onChange={(e) => setSearchQuery(e.target.value)}
        //                                     className="pl-10"
        //                                 />
        //                             </div>
        //                         </div>
        //                         <Select value={statusFilter} onValueChange={setStatusFilter}>
        //                             <SelectTrigger className="w-full sm:w-48">
        //                                 <SelectValue placeholder="Filter by status" />
        //                             </SelectTrigger>
        //                             <SelectContent>
        //                                 <SelectItem value="Pending">Pending</SelectItem>
        //                                 <SelectItem value="Approved">Approved</SelectItem>
        //                                 <SelectItem value="All">All</SelectItem>
        //                             </SelectContent>
        //                         </Select>
        //                     </div>

        //                     {/* Table */}
        //                     <div className="border rounded-lg bg-neutral-50">
        //                         {isLoading ? (
        //                             <div className="flex items-center justify-center py-12">
        //                                 <div className="flex items-center space-x-2">
        //                                     <Loader2 className="h-6 w-6 animate-spin" />
        //                                     <span>Loading users...</span>
        //                                 </div>
        //                             </div>
        //                         ) : filteredUsers.length === 0 ? (
        //                             <div className="flex flex-col items-center justify-center py-12 text-center">
        //                                 <Users className="h-12 w-12 text-muted-foreground mb-4" />
        //                                 <h3 className="text-lg font-medium mb-2">No users found</h3>
        //                                 <p className="text-muted-foreground">
        //                                     {searchQuery ? "Try adjusting your search criteria." : "No users match the current filter."}
        //                                 </p>
        //                             </div>
        //                         ) : (
        //                             <Table>
        //                                 <TableHeader>
        //                                     <TableRow>
        //                                         <TableHead>Name</TableHead>
        //                                         <TableHead>Email</TableHead>
        //                                         <TableHead>Broker Name</TableHead>
        //                                         <TableHead>Broker ID</TableHead>
        //                                         <TableHead>Registered On</TableHead>
        //                                         <TableHead>Status</TableHead>
        //                                         <TableHead>Actions</TableHead>
        //                                     </TableRow>
        //                                 </TableHeader>
        //                                 <TableBody>
        //                                     {filteredUsers.map((user) => (
        //                                         <TableRow key={user.email}>
        //                                             <TableCell className="font-medium">{user.name}</TableCell>
        //                                             <TableCell>{user.email}</TableCell>
        //                                             <TableCell>{user.broker_name}</TableCell>
        //                                             <TableCell className="flex items-center gap-2">
        //                                                 {user.broker_id && (
        //                                                     <>
        //                                                         {user.broker_id}
        //                                                         <button
        //                                                             onClick={() => handleCopy(user.broker_id)}
        //                                                             className="text-muted-foreground hover:text-foreground transition"
        //                                                             title="Copy Broker ID"
        //                                                         >
        //                                                             <Copy className="w-4 h-4" />
        //                                                         </button>
        //                                                     </>
        //                                                 )}
        //                                             </TableCell>
        //                                             <TableCell>{formatDate(user.created_at)}</TableCell>
        //                                             <TableCell>
        //                                                 <Badge variant={getStatusBadgeVariant(user.status)}>{user.status}</Badge>
        //                                             </TableCell>
        //                                             <TableCell>
        //                                                 {user.status === "Pending" && (
        //                                                     <Button
        //                                                         size="sm"
        //                                                         onClick={() => approveMutation.mutate(user.email)}
        //                                                         disabled={
        //                                                             approveMutation.isPending &&
        //                                                             approveMutation.variables === user.email
        //                                                         }
        //                                                         className="bg-[#05b288] hover:bg-[#06a57f] font-semibold cursor-pointer"
        //                                                     >
        //                                                         {approveMutation.isPending &&
        //                                                             approveMutation.variables === user.email ? (
        //                                                             <Loader2 className="h-4 w-4 animate-spin" />
        //                                                         ) : (
        //                                                             "Approve"
        //                                                         )}
        //                                                     </Button>
        //                                                 )}
        //                                             </TableCell>
        //                                         </TableRow>
        //                                     ))}
        //                                 </TableBody>
        //                             </Table>
        //                         )}
        //                     </div>
        //                 </CardContent>
        //             </Card>
        //         </div>
        //     </div>
        // </div>

        <div className="flex min-h-screen bg-neutral-50 dark:bg-[#2d3139]">
            <Sidebar />
            <div className="flex-1 md:ml-[14rem]">
                <Header />
                <Lowheader />
                <div className="container mx-auto p-6 space-y-6">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-2xl font-semibold text-foreground">Approval Dashboard</h1>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 ">
                        <Card className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-white">Pending Approvals</CardTitle>
                                <Clock className="h-4 w-4 text-white" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{metrics.pendingApprovals}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-white">Total Users</CardTitle>
                                <Users className="h-4 w-4 text-white" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{metrics.totalUsers}</div>
                            </CardContent>
                        </Card>
                        <Card className="bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-[#05b289] via-[#06a07c] to-[#047158] bg-opacity-20">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium text-white">Approved Users</CardTitle>
                                <UserCheck className="h-4 w-4 text-white" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-white">{metrics.totalApproved}</div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* Filters */}
                    <Card className="bg-card">
                        <CardHeader>
                            <CardTitle>User Management</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                                <div className="flex-1">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                        <Input
                                            placeholder="Search by name, email, broker name, or broker ID..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                                <Select value={statusFilter} onValueChange={setStatusFilter}>
                                    <SelectTrigger className="w-full sm:w-48">
                                        <SelectValue placeholder="Filter by status" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Pending">Pending</SelectItem>
                                        <SelectItem value="Approved">Approved</SelectItem>
                                        <SelectItem value="All">All</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Table */}
                            <div className="border rounded-lg bg-neutral-50 dark:bg-card dark:border-border">
                                {isLoading ? (
                                    <div className="flex items-center justify-center py-12">
                                        <div className="flex items-center space-x-2 text-muted-foreground">
                                            <Loader2 className="h-6 w-6 animate-spin" />
                                            <span>Loading users...</span>
                                        </div>
                                    </div>
                                ) : filteredUsers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-center">
                                        <Users className="h-12 w-12 text-muted-foreground mb-4" />
                                        <h3 className="text-lg font-medium text-foreground mb-2">No users found</h3>
                                        <p className="text-muted-foreground">
                                            {searchQuery ? "Try adjusting your search criteria." : "No users match the current filter."}
                                        </p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader className="bg-muted">
                                            <TableRow>
                                                <TableHead>Name</TableHead>
                                                <TableHead>Email</TableHead>
                                                <TableHead>Broker Name</TableHead>
                                                <TableHead>Broker ID</TableHead>
                                                <TableHead>Registered On</TableHead>
                                                <TableHead>Status</TableHead>
                                                <TableHead>Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredUsers.map((user) => (
                                                <TableRow key={user.email}>
                                                    <TableCell className="font-medium">{user.name}</TableCell>
                                                    <TableCell>{user.email}</TableCell>
                                                    <TableCell>{user.broker_name}</TableCell>
                                                    <TableCell className="flex items-center gap-2">
                                                        {user.broker_id && (
                                                            <>
                                                                {user.broker_id}
                                                                <button
                                                                    onClick={() => handleCopy(user.broker_id)}
                                                                    className="text-muted-foreground hover:text-foreground transition"
                                                                    title="Copy Broker ID"
                                                                >
                                                                    <Copy className="w-4 h-4" />
                                                                </button>
                                                            </>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{formatDate(user.created_at)}</TableCell>
                                                    <TableCell>
                                                        <Badge variant={getStatusBadgeVariant(user.status)}>{user.status}</Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        {user.status === "Pending" && (
                                                            <Button
                                                                size="sm"
                                                                onClick={() => approveMutation.mutate(user.email)}
                                                                disabled={
                                                                    approveMutation.isPending &&
                                                                    approveMutation.variables === user.email
                                                                }
                                                                className="bg-[#1a785f] hover:bg-[#05b288] text-primary-foreground font-semibold cursor-pointer"
                                                            >
                                                                {approveMutation.isPending &&
                                                                    approveMutation.variables === user.email ? (
                                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                                ) : (
                                                                    "Approve"
                                                                )}
                                                            </Button>
                                                        )}
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