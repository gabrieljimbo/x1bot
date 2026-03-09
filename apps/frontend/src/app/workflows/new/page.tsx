'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { apiClient } from '@/lib/api-client'
import { useAuth } from '@/contexts/AuthContext'
import { AuthGuard } from '@/components/AuthGuard'

function NewWorkflowPageContent() {
  const router = useRouter()
  
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!name.trim()) {
      setError('Name is required')
      return
    }

    setLoading(true)
    setError('')

    try {
      const workflow = await apiClient.createWorkflow(name, description)
      router.push(`/workflows/${workflow.id}`)
    } catch (err) {
      setError('Failed to create workflow')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <button
            onClick={() => router.push('/workspaces')}
            className="px-4 py-2 bg-surface border border-border rounded hover:border-primary transition mb-4"
          >
            ← Back
          </button>
          <h1 className="text-4xl font-bold mb-2">Create New Workflow</h1>
          <p className="text-gray-400">Build a conversational workflow for WhatsApp</p>
        </div>

        <div className="bg-surface border border-border rounded-lg p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2">
                Workflow Name *
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded focus:border-primary focus:outline-none"
                placeholder="e.g., Welcome Bot"
                required
              />
            </div>

            <div>
              <label htmlFor="description" className="block text-sm font-medium mb-2">
                Description
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-4 py-2 bg-background border border-border rounded focus:border-primary focus:outline-none"
                placeholder="What does this workflow do?"
                rows={4}
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500 rounded text-red-500">
                {error}
              </div>
            )}

            <div className="flex gap-4">
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-primary text-black rounded font-semibold hover:bg-primary/80 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Creating...' : 'Create Workflow'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/workspaces')}
                className="px-6 py-3 bg-surface border border-border rounded hover:border-primary transition"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>

        <div className="mt-8 p-6 bg-surface border border-border rounded-lg">
          <h2 className="text-xl font-semibold mb-4">💡 Quick Tips</h2>
          <ul className="space-y-2 text-gray-400">
            <li>• Start with a simple workflow and test it</li>
            <li>• Every workflow needs a TRIGGER node and an END node</li>
            <li>• Use WAIT_REPLY to collect user input</li>
            <li>• Test your workflow before activating it</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

export default function NewWorkflowPage() {
  return (
    <AuthGuard>
      <NewWorkflowPageContent />
    </AuthGuard>
  )
}





