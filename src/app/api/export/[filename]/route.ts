import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { filename } = await params;
    console.log('🚀 Export request for:', filename);

    // Extract format from filename (e.g., "line-1754941081197.png" -> "png")
    const format = filename.split('.').pop();
    
    if (!format || !['png', 'csv', 'pdf'].includes(format)) {
      return NextResponse.json({ error: 'Invalid export format' }, { status: 400 });
    }

    // For now, we'll create a simple placeholder file
    // In a real implementation, you would:
    // 1. Retrieve the chart data from the session/storage
    // 2. Generate the actual file content
    // 3. Return the file with proper headers

    let content: string;
    let contentType: string;
    let fileExtension: string;

    switch (format) {
      case 'png':
        // Create a simple SVG placeholder that can be converted to PNG
        content = `
          <svg width="600" height="400" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#f8f9fa"/>
            <text x="50%" y="50%" text-anchor="middle" font-family="Arial" font-size="24" fill="#6c757d">
              Chart Export - ${filename}
            </text>
            <text x="50%" y="70%" text-anchor="middle" font-family="Arial" font-size="16" fill="#6c757d">
              Generated on ${new Date().toLocaleDateString()}
            </text>
          </svg>
        `;
        contentType = 'image/svg+xml';
        fileExtension = 'svg';
        break;

      case 'csv':
        content = `Name,Value,Category
Sample Data 1,100,Category A
Sample Data 2,200,Category B
Sample Data 3,150,Category C
Generated on ${new Date().toLocaleDateString()}`;
        contentType = 'text/csv';
        fileExtension = 'csv';
        break;

      case 'pdf':
        // For PDF, we'll return a simple text representation
        content = `Chart Export Report
Generated on: ${new Date().toLocaleDateString()}
Filename: ${filename}

This is a placeholder PDF export.
In a real implementation, this would contain the actual chart data and visualization.`;
        contentType = 'text/plain';
        fileExtension = 'txt';
        break;

      default:
        return NextResponse.json({ error: 'Unsupported format' }, { status: 400 });
    }

    // Create response with file content
    const response = new NextResponse(content, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="chart-export-${Date.now()}.${fileExtension}"`,
        'Cache-Control': 'no-cache',
      },
    });

    return response;

  } catch (error) {
    console.error('❌ Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
} 