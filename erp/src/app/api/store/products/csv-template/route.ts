import { NextResponse } from 'next/server';

export async function GET() {
  const csv = [
    'Product Name,Category,Retail Price,SKU,Barcode,Brand,Description,Tags,Cost Price,Form,Pack Size,Low Stock Threshold,Wholesale Price',
    'Ashwagandha Powder,Herbal Powders,950.00,ASH-PWD-100,,Himalaya Ayurveda,Premium ashwagandha root powder,immunity,650.00,POWDER,100g,5,800.00',
    'Ashwagandha Capsules,Herbal Capsules,1450.00,ASH-CAP-60,,Himalaya Ayurveda,Standardised ashwagandha extract 60-caps,immunity,950.00,CAPSULE,500mg x 60,5,1300.00',
  ].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="ayurpos-import-template.csv"',
    },
  });
}
