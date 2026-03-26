export const hasPermission = (role: any, group: string, keyword: string) => {
  const items = role?.permissions?.[group] || []
  return items.some((item: string) =>
    item.toLowerCase().includes(keyword.toLowerCase())
  )
}

export const canAccessTab = (role: any, tabId: string) => {
  if (!role) return false
  if (role.id === 'admin') return true

  switch (tabId) {
    case 'dashboard':
      return true
    case 'orders':
      return hasPermission(role, 'orders', 'xem đơn')
    case 'create-order':
      return hasPermission(role, 'orders', 'tạo đơn')
    case 'products':
      return hasPermission(role, 'products', 'xem sản phẩm')
    case 'inventory':
      return hasPermission(role, 'inventory', 'xem tồn kho')
    case 'stocktake':
      return hasPermission(role, 'inventory', 'kiểm kho')
    case 'ads':
      return (
        hasPermission(role, 'orders', 'hãng vận chuyển') ||
        hasPermission(role, 'reports', 'xem báo cáo')
      )
    case 'ai-content':
      return (
        hasPermission(role, 'products', 'xem sản phẩm') &&
        hasPermission(role, 'orders', 'tạo đơn')
      )
    case 'reports':
      return hasPermission(role, 'reports', 'xem báo cáo')
    case 'permissions':
      return hasPermission(role, 'system', 'phân quyền')
    default:
      return false
  }
}

export const currency = (n: number | string) =>
  new Intl.NumberFormat('vi-VN').format(Number(n || 0)) + 'đ'

export const formatDate = () => new Date().toLocaleString('vi-VN')

export function summarizePermissions(items: string[]) {
  if (!items || !items.length) return 'Chưa có quyền'
  if (items.length <= 3) return `Có quyền: ${items.join(', ')}`
  return `Có quyền: ${items.slice(0, 3).join(', ')} +${items.length - 3} quyền khác`
}

export function toneForStatus(value: string) {
  if (
    ['ACTIVE', 'CONFIRMED', 'FULFILLED', 'PAID', 'COMPLETED', 'CONNECTED'].includes(
      value
    )
  )
    return 'green'
  if (
    [
      'AWAITING_PAYMENT',
      'PENDING',
      'PENDING_COD',
      'PROCESSING',
      'IN_PROGRESS',
    ].includes(value)
  )
    return 'amber'
  if (['CANCELLED', 'FAILED', 'INACTIVE', 'NEEDS_MAPPING'].includes(value))
    return 'red'
  return 'gray'
}