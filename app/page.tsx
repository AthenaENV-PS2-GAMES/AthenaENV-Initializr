import AthenaInitializr, { type AthenaCatalog } from '@/components/athena-initializr'

const CATALOG_URL = 'https://gibrankhalil.github.io/AthenaEnv/catalog.json'
const TYPES_URL = 'https://gibrankhalil.github.io/AthenaEnv/athena.d.ts'

async function fetchText(url: string) {
  const response = await fetch(url, { next: { revalidate: 300 } })
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`)
  return response.text()
}

export default async function Page() {
  let catalog: AthenaCatalog = {}
  let types = ''
  let catalogError = ''
  try {
    const [catalogText, typesResult] = await Promise.all([fetchText(CATALOG_URL), fetchText(TYPES_URL)])
    catalog = JSON.parse(catalogText) as AthenaCatalog
    types = typesResult
  } catch (error) {
    catalogError = error instanceof Error ? error.message : 'erro desconhecido'
  }
  return <AthenaInitializr catalog={catalog} types={types} catalogError={catalogError} />
}
