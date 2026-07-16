import { NextResponse } from 'next/server';

export async function GET() {
  const csv = [
    'Product Name,Category,Retail Price,SKU,Barcode,Brand,Description,Gender,Tags,Cost Price,Size,Colour,Low Stock Threshold,Wholesale Price',
    'Classic Oxford Shirt,Shirts,1250.00,OXF-BLU-M,,Oxford Brand,A premium cotton oxford shirt,Men,"formal,cotton",850.00,M,Blue,5,1100.00',
    'Classic Oxford Shirt,Shirts,1250.00,OXF-BLU-L,,Oxford Brand,A premium cotton oxford shirt,Men,"formal,cotton",850.00,L,Blue,5,1100.00',
  ].join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': 'attachment; filename="velvetpos-import-template.csv"',
    },
  });
}
