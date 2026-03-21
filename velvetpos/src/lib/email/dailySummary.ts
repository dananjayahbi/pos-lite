export interface DailySummaryData {
  tenantName: string;
  date: string; // formatted date string e.g. "March 20, 2026"
  totalSales: string; // formatted currency
  transactionCount: number;
  topProductName: string | null;
  topProductQty: number;
  cashFloat: string; // formatted currency from latest shift opening float
  tenantSlug: string;
}

export function composeDailySummaryEmail(data: DailySummaryData): string {
  const {
    tenantName,
    date,
    totalSales,
    transactionCount,
    topProductName,
    topProductQty,
    cashFloat,
    tenantSlug,
  } = data;

  const reportsUrl = `https://${tenantSlug}.velvetpos.com/reports`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Daily Sales Summary — ${tenantName}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f1ec;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f1ec;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;">
          <!-- Header -->
          <tr>
            <td style="background-color:#3A2D28;padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;">VelvetPOS</h1>
              <p style="margin:4px 0 0;color:#CBAD8D;font-size:14px;">${tenantName}</p>
            </td>
          </tr>

          <!-- Title -->
          <tr>
            <td style="padding:28px 32px 8px;">
              <h2 style="margin:0;color:#3A2D28;font-size:20px;font-weight:700;">Daily Sales Summary</h2>
              <p style="margin:4px 0 0;color:#6b6b6b;font-size:14px;">${date}</p>
            </td>
          </tr>

          <!-- Stats Grid 2×2 -->
          <tr>
            <td style="padding:16px 32px 24px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                    <div style="background-color:#f9f6f3;border-radius:8px;padding:20px;border-left:4px solid #A48374;">
                      <p style="margin:0;color:#6b6b6b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Total Sales</p>
                      <p style="margin:6px 0 0;color:#3A2D28;font-size:24px;font-weight:700;">${totalSales}</p>
                    </div>
                  </td>
                  <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                    <div style="background-color:#f9f6f3;border-radius:8px;padding:20px;border-left:4px solid #A48374;">
                      <p style="margin:0;color:#6b6b6b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Transactions</p>
                      <p style="margin:6px 0 0;color:#3A2D28;font-size:24px;font-weight:700;">${transactionCount}</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:8px 8px 8px 0;vertical-align:top;">
                    <div style="background-color:#f9f6f3;border-radius:8px;padding:20px;border-left:4px solid #CBAD8D;">
                      <p style="margin:0;color:#6b6b6b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Top Product</p>
                      <p style="margin:6px 0 0;color:#3A2D28;font-size:16px;font-weight:700;">${topProductName ?? 'N/A'}</p>
                      ${topProductName ? `<p style="margin:2px 0 0;color:#6b6b6b;font-size:12px;">${topProductQty} units sold</p>` : ''}
                    </div>
                  </td>
                  <td width="50%" style="padding:8px 0 8px 8px;vertical-align:top;">
                    <div style="background-color:#f9f6f3;border-radius:8px;padding:20px;border-left:4px solid #CBAD8D;">
                      <p style="margin:0;color:#6b6b6b;font-size:12px;text-transform:uppercase;letter-spacing:0.5px;">Cash Float</p>
                      <p style="margin:6px 0 0;color:#3A2D28;font-size:24px;font-weight:700;">${cashFloat}</p>
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td align="center" style="padding:0 32px 32px;">
              <a href="${reportsUrl}" target="_blank" style="display:inline-block;background-color:#A48374;color:#ffffff;text-decoration:none;padding:14px 32px;border-radius:6px;font-size:14px;font-weight:600;">View Full Report</a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#EBE3DB;padding:20px 32px;">
              <p style="margin:0;color:#6b6b6b;font-size:12px;text-align:center;">This is an automated summary from VelvetPOS. You receive this because you are an owner of ${tenantName}.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
