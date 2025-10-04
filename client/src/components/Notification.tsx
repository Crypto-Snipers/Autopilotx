import React, { useState } from 'react'
import { X } from "lucide-react";

const Notification = () => {
    const [showNotifications, setShowNotifications] = useState(false);
    return (
        <div className="absolute top-0 right-0 h-full w-80 bg-white shadow-lg z-50">
            <div className="flex justify-between items-center p-4 border-b">
                <h3 className="text-lg font-medium">Notifications</h3>
                <button onClick={() => setShowNotifications(false)}>
                    <X className="h-5 w-5" />
                </button>
            </div>

            <div className="p-4">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                            <div className="text-green-600">✓</div>
                        </div>
                        <div className="flex-1">
                            <h4 className="font-medium">Blog post published</h4>
                        </div>
                    </div>
                    <button>
                        <X className="h-4 w-4 text-gray-400" />
                    </button>
                </div>
                <p className="text-sm text-gray-600 pl-8 mb-4">This blog post has been published. Team members will be able to edit this post and republish changes.</p>
            </div>
        </div>
    )
}

export default Notification
