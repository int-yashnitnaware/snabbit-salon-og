import { getMockProfiles } from '@/lib/mock-data'
import StaffTable from '@/components/admin/StaffTable'

export default function AdminStaffPage() {
  const staff = getMockProfiles().filter(
    (p) => p.role === 'staff' || p.role === 'team_lead'
  )
  return (
    <div className="max-w-md mx-auto">
      <StaffTable staff={staff} />
    </div>
  )
}
