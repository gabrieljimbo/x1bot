import { NodeExecutorService } from './node-executor.service';
import { ContextService } from './context.service';
import { ConfigService } from '@nestjs/config';
import { ContactTagsService } from './contact-tags.service';
import { OCRService } from './ocr.service';
import { WorkflowNodeType, ExecutionContext, HttpScrapeConfig } from '@n9n/shared';

// Mock puppeteer before importing the service
const mockPage = {
  setViewport: jest.fn().mockResolvedValue(undefined),
  setExtraHTTPHeaders: jest.fn().mockResolvedValue(undefined),
  goto: jest.fn().mockResolvedValue(undefined),
  waitForSelector: jest.fn().mockResolvedValue(undefined),
  evaluate: jest.fn().mockResolvedValue(null),
  content: jest.fn().mockResolvedValue('<html><body>Test</body></html>'),
  screenshot: jest.fn().mockResolvedValue(Buffer.from('fake-image')),
  title: jest.fn().mockResolvedValue('Test Page'),
  close: jest.fn().mockResolvedValue(undefined),
};

const mockBrowser = {
  newPage: jest.fn().mockResolvedValue(mockPage),
  close: jest.fn().mockResolvedValue(undefined),
};

jest.mock('puppeteer', () => ({
  launch: jest.fn().mockResolvedValue(mockBrowser),
}));

describe('NodeExecutorService - HTTP_SCRAPE', () => {
  let service: NodeExecutorService;
  let contextService: ContextService;

  beforeEach(() => {
    contextService = new ContextService();
    const configService = new ConfigService();
    const contactTagsService = {} as ContactTagsService;
    const rmktQueue = { add: jest.fn() } as any;
    const ocrService = {} as OCRService;

    service = new NodeExecutorService(
      contextService,
      configService,
      contactTagsService,
      ocrService,
      rmktQueue,
    );

    // Reset mocks
    jest.clearAllMocks();
    mockPage.setViewport.mockResolvedValue(undefined);
    mockPage.setExtraHTTPHeaders.mockResolvedValue(undefined);
    mockPage.goto.mockResolvedValue(undefined);
    mockPage.waitForSelector.mockResolvedValue(undefined);
    mockPage.evaluate.mockResolvedValue(null);
    mockPage.content.mockResolvedValue('<html><body>Test</body></html>');
    mockPage.screenshot.mockResolvedValue(Buffer.from('fake-image'));
    mockPage.title.mockResolvedValue('Test Page');
    mockPage.close.mockResolvedValue(undefined);
    mockBrowser.newPage.mockResolvedValue(mockPage);
    mockBrowser.close.mockResolvedValue(undefined);
  });


  describe('executeHttpScrape', () => {
    it('should scrape a simple page', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          waitFor: 'networkidle2',
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      const result = await (service as any).executeHttpScrape(node, context, edges);

      expect(result.nextNodeId).toBe('node2');
      expect(result.shouldWait).toBe(false);
      expect(result.output?.scrapeResponse).toBeDefined();
      expect(result.output?.scrapeResponse.url).toBe('https://example.com');
      expect(result.output?.scrapeResponse.html).toBeDefined();
      expect(context.variables.scrapeResponse).toBeDefined();
    });

    it('should extract data using selector', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      mockPage.evaluate.mockResolvedValueOnce('<div>Extracted Content</div>');

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          extractSelector: '.content',
          extractType: 'html',
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      const result = await (service as any).executeHttpScrape(node, context, edges);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.output?.scrapeResponse.html).toBe('<div>Extracted Content</div>');
    });

    it('should wait for selector when configured', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          waitFor: 'selector',
          waitSelector: '.content',
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      await (service as any).executeHttpScrape(node, context, edges);

      expect(mockPage.waitForSelector).toHaveBeenCalledWith('.content', { timeout: 30000 });
    });

    it('should execute custom script', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      mockPage.evaluate.mockResolvedValueOnce('Script Result');

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          executeScript: 'return document.title;',
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      const result = await (service as any).executeHttpScrape(node, context, edges);

      expect(mockPage.evaluate).toHaveBeenCalled();
      expect(result.output?.scrapeResponse.scriptResult).toBe('Script Result');
    });

    it('should take screenshot when configured', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          screenshot: true,
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      const result = await (service as any).executeHttpScrape(node, context, edges);

      expect(mockPage.screenshot).toHaveBeenCalled();
      expect(result.output?.scrapeResponse.screenshot).toBeDefined();
    });

    it('should handle errors gracefully', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      mockBrowser.newPage.mockRejectedValueOnce(new Error('Navigation failed'));

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://invalid-url.com',
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      const result = await (service as any).executeHttpScrape(node, context, edges);

      expect(result.nextNodeId).toBe('node2');
      expect(result.output?.scrapeResponse.error).toBe(true);
      expect(result.output?.scrapeResponse.message).toBeDefined();
    });

    it('should interpolate variables in URL', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: { domain: 'example.com' },
      };

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://{{variables.domain}}',
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      const result = await (service as any).executeHttpScrape(node, context, edges);

      expect(result.output?.scrapeResponse.url).toBe('https://example.com');
    });

    it('should set custom headers', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          headers: [
            { key: 'User-Agent', value: 'TestBot' },
            { key: 'Accept', value: 'text/html' },
          ],
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      await (service as any).executeHttpScrape(node, context, edges);

      expect(mockPage.setExtraHTTPHeaders).toHaveBeenCalledWith({
        'User-Agent': 'TestBot',
        Accept: 'text/html',
      });
    });

    it('should set viewport when configured', async () => {
      const context: ExecutionContext = {
        globals: {},
        input: {},
        output: {},
        variables: {},
      };

      const node = {
        id: 'node1',
        type: WorkflowNodeType.HTTP_SCRAPE,
        config: {
          url: 'https://example.com',
          viewport: { width: 1280, height: 720 },
          saveResponseAs: 'scrapeResponse',
        } as HttpScrapeConfig,
      };

      const edges: any[] = [{ source: 'node1', target: 'node2' }];

      await (service as any).executeHttpScrape(node, context, edges);

      expect(mockPage.setViewport).toHaveBeenCalledWith({
        width: 1280,
        height: 720,
      });
    });
  });
});

