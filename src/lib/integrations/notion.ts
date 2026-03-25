/**
 * Notion CRM integration — ported from notion_service.py
 *
 * Requires env vars:
 * - NOTION_API_TOKEN
 * - NOTION_CRM_DATABASE_ID
 */

interface NotionProperties {
  [key: string]: unknown
}

/**
 * Add a client record to Notion CRM database
 */
export async function agregarClienteANotion(params: {
  nombre: string
  documento: string
  direccion: string
  proyecto: string
  fecha: string
  estado?: string
}): Promise<{ success: boolean; message: string }> {
  const token = process.env.NOTION_API_TOKEN
  const databaseId = process.env.NOTION_CRM_DATABASE_ID

  if (!token || !databaseId) {
    return { success: false, message: 'Notion integration not configured' }
  }

  const { nombre, documento, direccion, proyecto, fecha, estado = 'En conversaciones' } = params

  // Property names (configurable via env)
  const propName = process.env.NOTION_PROP_NAME ?? 'Name'
  const propStatus = process.env.NOTION_PROP_STATUS ?? 'Estado'
  const propDoc = process.env.NOTION_PROP_DOCUMENTO ?? 'Documento'
  const propDir = process.env.NOTION_PROP_DIRECCION ?? 'Direccion'
  const propProject = process.env.NOTION_PROP_PROYECTO ?? 'Proyecto'
  const propDate = process.env.NOTION_PROP_FECHA ?? 'Fecha'

  const baseProperties: NotionProperties = {
    [propName]: { title: [{ text: { content: nombre } }] },
    [propDoc]: { rich_text: [{ text: { content: documento } }] },
    [propDir]: { rich_text: [{ text: { content: direccion } }] },
    [propProject]: { rich_text: [{ text: { content: proyecto } }] },
    [propDate]: { date: { start: fecha } },
  }

  // Try with status type first, fallback to select
  for (const statusType of ['status', 'select'] as const) {
    try {
      const properties = {
        ...baseProperties,
        [propStatus]: { [statusType]: { name: estado } },
      }

      const res = await fetch('https://api.notion.com/v1/pages', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Notion-Version': '2022-06-28',
        },
        body: JSON.stringify({
          parent: { database_id: databaseId },
          properties,
        }),
      })

      if (res.ok) {
        return { success: true, message: `Client added to Notion (${statusType})` }
      }

      // If status type failed, try next type
      if (statusType === 'status') continue

      const error = await res.text()
      return { success: false, message: `Notion API error: ${error}` }
    } catch (error) {
      if (statusType === 'select') {
        return { success: false, message: `Notion error: ${error}` }
      }
    }
  }

  return { success: false, message: 'Failed to add to Notion' }
}
