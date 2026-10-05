import BrandLoader from '@/components/brand/BrandLoader'

// Renders inside the dashboard layout: sidebar and header stay, the content area shows the mark.
export default function Loading() {
  return <BrandLoader variant="section" size="lg" minHeight="60vh" />
}
