import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { auth } from '@clerk/nextjs/server';
import { logger } from '@/lib/logger';
import { TokenStorage } from '@/lib/tokenStorage';

export async function POST(request: NextRequest) {
  let userId: string | null = null;
  try {
    const authResult = await auth();
    userId = authResult.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { chartData, chartConfig, chartTitle } = body;

    logger.info('Google Sheets export requested', {
      userId,
      chartTitle,
      dataPoints: chartData?.length || 0
    });

    // Get user's Google tokens from custom TokenStorage
    const tokenData = await TokenStorage.getTokenInfo(userId);
    
    if (!tokenData || !tokenData.accessToken) {
      logger.error('No Google tokens found in TokenStorage', undefined, { userId });
      return NextResponse.json({ 
        error: 'Google authentication required',
        message: 'Please connect your Google account in Admin settings to export charts to Google Sheets.',
        action: 'connect_google'
      }, { status: 401 });
    }

    // Check if token is expired
    if (tokenData.expiresAt < Date.now()) {
      logger.error('Google token expired', undefined, { userId });
      return NextResponse.json({ 
        error: 'Google authentication expired',
        message: 'Please reconnect your Google account in Admin settings.',
        action: 'connect_google'
      }, { status: 401 });
    }

    // Initialize Google Sheets API
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI
    );

    oauth2Client.setCredentials({
      access_token: tokenData.accessToken,
      refresh_token: tokenData.refreshToken,
    });

    const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

    // Create a new spreadsheet
    const createResponse = await sheets.spreadsheets.create({
      requestBody: {
        properties: {
          title: `${chartTitle || 'Chart Data'} - ${new Date().toLocaleDateString()}`,
        },
      },
    });

    const spreadsheetId = createResponse.data.spreadsheetId;
    if (!spreadsheetId) {
      throw new Error('Failed to create spreadsheet');
    }

    // Prepare data for sheets
    const xAxisKey = chartConfig?.xAxis?.dataKey || 'name';
    const yAxisKey = chartConfig?.yAxis?.dataKey || 'value';
    
    // Create headers
    const headers = [xAxisKey, yAxisKey];
    
    // Create data rows
    const dataRows = chartData.map((item: any) => [
      item[xAxisKey] || item.name || 'Unknown',
      item[yAxisKey] || item.value || item.count || item.sum || 0
    ]);

    // Write data to sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: 'Sheet1!A1',
      valueInputOption: 'RAW',
      requestBody: {
        values: [headers, ...dataRows],
      },
    });

    // Format headers
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            repeatCell: {
              range: {
                sheetId: 0,
                startRowIndex: 0,
                endRowIndex: 1,
                startColumnIndex: 0,
                endColumnIndex: headers.length,
              },
              cell: {
                userEnteredFormat: {
                  backgroundColor: { red: 0.2, green: 0.6, blue: 0.9 },
                  textFormat: {
                    bold: true,
                    foregroundColor: { red: 1, green: 1, blue: 1 },
                  },
                },
              },
              fields: 'userEnteredFormat(backgroundColor,textFormat)',
            },
          },
          // Auto-resize columns
          {
            autoResizeDimensions: {
              dimensions: {
                sheetId: 0,
                dimension: 'COLUMNS',
                startIndex: 0,
                endIndex: headers.length,
              },
            },
          },
        ],
      },
    });

    // Create chart
    if (chartData.length > 0) {
      const chartType = chartConfig?.chartType || 'COLUMN';
      const googleChartType = chartType === 'pie' ? 'PIE' : 
                             chartType === 'line' ? 'LINE' : 
                             chartType === 'area' ? 'AREA' : 'COLUMN';

      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addChart: {
                chart: {
                  spec: {
                    title: chartTitle || 'Chart Visualization',
                    basicChart: {
                      chartType: googleChartType,
                      legendPosition: 'BOTTOM_LEGEND',
                      axis: [
                        {
                          position: 'BOTTOM_AXIS',
                          title: xAxisKey,
                        },
                        {
                          position: 'LEFT_AXIS',
                          title: yAxisKey,
                        },
                      ],
                      domains: [
                        {
                          domain: {
                            sourceRange: {
                              sources: [
                                {
                                  sheetId: 0,
                                  startRowIndex: 0,
                                  endRowIndex: dataRows.length + 1,
                                  startColumnIndex: 0,
                                  endColumnIndex: 1,
                                },
                              ],
                            },
                          },
                        },
                      ],
                      series: [
                        {
                          series: {
                            sourceRange: {
                              sources: [
                                {
                                  sheetId: 0,
                                  startRowIndex: 0,
                                  endRowIndex: dataRows.length + 1,
                                  startColumnIndex: 1,
                                  endColumnIndex: 2,
                                },
                              ],
                            },
                          },
                          targetAxis: 'LEFT_AXIS',
                        },
                      ],
                    },
                  },
                  position: {
                    overlayPosition: {
                      anchorCell: {
                        sheetId: 0,
                        rowIndex: dataRows.length + 3,
                        columnIndex: 0,
                      },
                      widthPixels: 600,
                      heightPixels: 400,
                    },
                  },
                },
              },
            },
          ],
        },
      });
    }

    // Get the spreadsheet URL
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    logger.info('Google Sheets export completed successfully', {
      userId,
      spreadsheetId,
      spreadsheetUrl,
      dataPoints: dataRows.length
    });

    return NextResponse.json({
      success: true,
      spreadsheetUrl,
      spreadsheetId,
      message: 'Chart data exported to Google Sheets successfully'
    });

  } catch (error) {
    logger.error('Error exporting to Google Sheets', error instanceof Error ? error : new Error(String(error)), {
      userId: userId || 'unknown'
    });

    return NextResponse.json(
      { error: 'Failed to export to Google Sheets' },
      { status: 500 }
    );
  }
}
