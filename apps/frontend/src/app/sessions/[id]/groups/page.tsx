'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'

interface GroupConfig {
    id: string
    sessionId: string
    groupId: string
    name: string
    enabled: boolean
    workflowIds: string[]
}

function GroupManagementPageContent({ params }: { params: { id: string } }) {
    const router = useRouter()
    const { tenant } = useAuth()
    const sessionId = params.id

    const [groupConfigs, setGroupConfigs] = useState<GroupConfig[]>([])
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [syncing, setSyncing] = useState(false)

    useEffect(() => {
        if (sessionId) {
            loadData()
        }
    }, [sessionId])

    const loadData = async () => {
        setLoading(true)
        try {
            const [configs, workflowsData] = await Promise.all([
                apiClient.getGroupConfigs(sessionId),
                apiClient.getWorkflows(tenant?.id)
            ])
            setGroupConfigs(configs)
            setWorkflows(workflowsData.filter((w: any) => w.isActive))
        } catch (error) {
            console.error('Error loading group data:', error)
        } finally {
            setLoading(false)
        }
    }

    const handleSync = async () => {
        setSyncing(true)
        try {
            await apiClient.syncGroups(sessionId)
            await loadData()
        } catch (error) {
            console.error('Error syncing groups:', error)
            alert('Failed to sync groups')
        } finally {
            setSyncing(false)
        }
    }

    const handleToggleEnable = async (config: GroupConfig) => {
        try {
            await apiClient.updateGroupConfig(sessionId, config.id, !config.enabled, config.workflowIds)
            setGroupConfigs(prev => prev.map(c => c.id === config.id ? { ...c, enabled: !c.enabled } : c))
        } catch (error) {
            console.error('Error updating group config:', error)
            alert('Failed to update group status')
        }
    }

    const handleWorkflowChange = async (configId: string, workflowId: string, checked: boolean) => {
        const config = groupConfigs.find(c => c.id === configId)
        if (!config) return

        let newWorkflowIds = [...config.workflowIds]
        if (checked) {
            newWorkflowIds.push(workflowId)
        } else {
            newWorkflowIds = newWorkflowIds.filter(id => id !== workflowId)
        }

        try {
            await apiClient.updateGroupConfig(sessionId, configId, config.enabled, newWorkflowIds)
            setGroupConfigs(prev => prev.map(c => c.id === configId ? { ...c, workflowIds: newWorkflowIds } : c))
        } catch (error) {
            console.error('Error updating workflow linkage:', error)
            alert('Failed to update workflows for group')
        }
    }

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-xl">Loading Group Management...</div>
            </div>
        )
    }

    return (
        <div className="min-h-screen p-8">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <button
                            onClick={() => router.push(`/sessions/${sessionId}`)}
                            className="text-primary hover:underline mb-2 block"
                        >
                            ← Back to Session
                        </button>
                        <h1 className="text-4xl font-bold">Group Management</h1>
                        <p className="text-gray-400 mt-2">Authorize groups and link workflows. All other group messages will be ignored.</p>
                    </div>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className={`px-6 py-3 rounded font-semibold transition ${syncing ? 'bg-gray-700 cursor-not-allowed' : 'bg-primary text-black hover:bg-primary/80'
                            }`}
                    >
                        {syncing ? '🔄 Syncing...' : '🔄 Sync Groups'}
                    </button>
                </div>

                <div className="bg-surface border border-border rounded-lg overflow-hidden">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-background border-b border-border">
                                <th className="p-4">Group Name / JID</th>
                                <th className="p-4">Bot Enabled</th>
                                <th className="p-4">Linked Workflows</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupConfigs.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="p-8 text-center text-gray-400">
                                        No groups found. Click "Sync Groups" to fetch groups from WhatsApp.
                                    </td>
                                </tr>
                            ) : (
                                groupConfigs.map((config) => (
                                    <tr key={config.id} className="border-b border-border hover:bg-white/5 transition">
                                        <td className="p-4">
                                            <div className="font-semibold">{config.name}</div>
                                            <div className="text-xs text-gray-500 font-mono">{config.groupId}</div>
                                        </td>
                                        <td className="p-4">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={config.enabled}
                                                    onChange={() => handleToggleEnable(config)}
                                                />
                                                <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
                                                <span className="ml-3 text-sm font-medium text-gray-300">
                                                    {config.enabled ? 'Active' : 'Disabled'}
                                                </span>
                                            </label>
                                        </td>
                                        <td className="p-4">
                                            <div className="grid grid-cols-1 gap-2">
                                                {workflows.length === 0 ? (
                                                    <span className="text-sm text-gray-500 italic">No active workflows available</span>
                                                ) : (
                                                    workflows.map((workflow) => (
                                                        <label key={workflow.id} className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer hover:text-white">
                                                            <input
                                                                type="checkbox"
                                                                className="rounded border-gray-700 bg-background text-primary focus:ring-primary"
                                                                checked={config.workflowIds.includes(workflow.id)}
                                                                onChange={(e) => handleWorkflowChange(config.id, workflow.id, e.target.checked)}
                                                            />
                                                            {workflow.name}
                                                        </label>
                                                    ))
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-6">
                    <h3 className="text-yellow-500 font-bold mb-2">⚠️ Standard Behavior</h3>
                    <ul className="list-disc list-inside text-sm text-gray-400 space-y-1">
                        <li>The bot will ignore **all** messages in groups unless they are listed above and marked as **Active**.</li>
                        <li>Only **Linked Workflows** will trigger when the bot is active in a group.</li>
                        <li>Messages from the bot itself (`fromMe: true`) are always ignored to prevent loops.</li>
                        <li>If you just joined a group, click **Sync Groups** to refresh the list.</li>
                    </ul>
                </div>
            </div>
        </div>
    )
}

export default function GroupManagementPage({ params }: { params: { id: string } }) {
    return (
        <AuthGuard>
            <GroupManagementPageContent params={params} />
        </AuthGuard>
    )
}
