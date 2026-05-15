import StockTransferDetailPageClient from "@/components/admin/stock-transfers/StockTransferDetailPageClient";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function StockTransferDetailPage({ params }: PageProps) {
  const { id } = await params;

  return <StockTransferDetailPageClient transferId={id} />;
}