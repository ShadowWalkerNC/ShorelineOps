export type WorkOrderPriority = 'Low' | 'Medium' | 'High' | 'Critical'
export type WorkOrderStatus = 'Open' | 'In Progress' | 'Completed'

export type WorkOrder = {
  id: string
  title: string
  location: string
  priority: WorkOrderPriority
  status: WorkOrderStatus
  submittedBy: string
  createdAt: string
  notes?: string
}
