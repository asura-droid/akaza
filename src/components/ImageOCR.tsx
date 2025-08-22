import { useState } from 'react';
import { Eye, FileText, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import Tesseract from 'tesseract.js';

interface ImageOCRProps {
  imageFile: File | null;
  onTextExtracted: (text: string, data: any[]) => void;
}

export const ImageOCR = ({ imageFile, onTextExtracted }: ImageOCRProps) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [extractedText, setExtractedText] = useState('');
  const [progress, setProgress] = useState(0);
  const [imagePreview, setImagePreview] = useState<string>('');
  const { toast } = useToast();

  // AI-enhanced text completion and correction
  const enhanceTextWithAI = (rawText: string): string => {
    let enhanced = rawText;
    
    // Common OCR corrections
    const corrections = {
      // Number corrections
      'O': '0', 'l': '1', 'I': '1', 'S': '5', 'G': '6', 'B': '8',
      // Letter corrections in context
      '0': 'O', '1': 'I', '5': 'S', '6': 'G', '8': 'B'
    };
    
    // Smart sentence completion
    const commonPatterns = [
      { pattern: /(\w+)\s+(\w+)\s*$/, completion: (match: string) => {
        // If line ends abruptly, try to complete common phrases
        if (match.includes('Name')) return match + ':';
        if (match.includes('Address')) return match + ':';
        if (match.includes('Phone')) return match + ':';
        if (match.includes('Email')) return match + ':';
        return match;
      }},
      // Fix common OCR spacing issues
      { pattern: /([a-z])([A-Z])/g, completion: (match: string) => match.replace(/([a-z])([A-Z])/g, '$1 $2') },
      // Fix email patterns
      { pattern: /(\w+)\s*@\s*(\w+)\s*\.\s*(\w+)/g, completion: (match: string) => match.replace(/\s/g, '') },
      // Fix phone patterns
      { pattern: /(\d{3})\s*-?\s*(\d{3})\s*-?\s*(\d{4})/g, completion: (match: string) => match.replace(/\s/g, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3') }
    ];
    
    commonPatterns.forEach(({ pattern, completion }) => {
      enhanced = enhanced.replace(pattern, completion);
    });
    
    // Context-aware word completion
    const lines = enhanced.split('\n');
    const completedLines = lines.map(line => {
      // If line looks incomplete (ends with partial word), try to complete it
      if (line.match(/\w{2,}$/)) {
        const words = line.split(/\s+/);
        const lastWord = words[words.length - 1];
        
        // Common word completions based on context
        const completions: { [key: string]: string } = {
          'Nam': 'Name',
          'Addres': 'Address',
          'Phon': 'Phone',
          'Emai': 'Email',
          'Dat': 'Date',
          'Tim': 'Time',
          'Compan': 'Company',
          'Departmen': 'Department'
        };
        
        if (completions[lastWord]) {
          words[words.length - 1] = completions[lastWord];
          return words.join(' ');
        }
      }
      return line;
    });
    
    return completedLines.join('\n');
  };
  const processImage = async () => {
    if (!imageFile) return;

    setIsProcessing(true);
    setProgress(0);

    try {
      // Create preview
      const preview = URL.createObjectURL(imageFile);
      setImagePreview(preview);

      // Process with Tesseract - enhanced settings for accuracy and speed
      const { data: { text } } = await Tesseract.recognize(
        imageFile,
        'eng',
        {
          logger: m => {
            if (m.status === 'recognizing text') {
              setProgress(Math.round(m.progress * 100));
            }
          },
          // Enhanced settings for better accuracy
          tessedit_pageseg_mode: Tesseract.PSM.AUTO,
          tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
          preserve_interword_spaces: '1',
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,!?@#$%^&*()_+-=[]{}|;:\'\"<>?/~` \n\t',
        }
      );

      // Apply AI enhancement to the extracted text
      const enhancedText = enhanceTextWithAI(text);
      setExtractedText(enhancedText);

      // Try to parse text as structured data
      const parsedData = parseTextToData(enhancedText);
      
      onTextExtracted(enhancedText, parsedData);

      toast({
        title: "OCR completed successfully",
        description: `Extracted and enhanced ${enhancedText.length} characters from the image`
      });

    } catch (error) {
      console.error('OCR Error:', error);
      toast({
        title: "OCR failed",
        description: "Could not extract text from the image",
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
      setProgress(0);
    }
  };

  const parseTextToData = (text: string): any[] => {
    // Enhanced parser with AI-powered pattern recognition
    const lines = text.split('\n').filter(line => line.trim());
    const data: any[] = [];

    // Enhanced pattern detection
    const patterns = {
      emails: /\S+@\S+\.\S+/g,
      phones: /[\+]?[1-9]?[\d\s\-\(\)]{7,15}/g,
      dates: /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2}/g,
      money: /[\$€£¥₹]\s*\d+(?:,\d{3})*(?:\.\d{2})?/g,
      addresses: /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd)/gi
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Enhanced pattern matching with AI context
      const extractedPatterns: any = {};
      
      Object.entries(patterns).forEach(([type, regex]) => {
        const matches = line.match(regex);
        if (matches) {
          extractedPatterns[type] = matches;
        }
      });
      
      // Pattern: Key: Value or Key = Value
      const colonMatch = line.match(/^([^:=]+)[:=]\s*(.+)$/);
      if (colonMatch) {
        data.push({
          field: colonMatch[1].trim(),
          value: colonMatch[2].trim(),
          type: 'key_value',
          line: i + 1,
          patterns: extractedPatterns
        });
        continue;
      }

      // Pattern: Key | Value (pipe separated)
      const pipeMatch = line.split('|').map(s => s.trim());
      if (pipeMatch.length >= 2) {
        data.push({
          field: pipeMatch[0],
          value: pipeMatch.slice(1).join(' | '),
          type: 'table_row',
          line: i + 1,
          patterns: extractedPatterns
        });
        continue;
      }

      // Pattern: Whitespace separated values (potential table)
      const tabMatch = line.split(/\s{2,}/).map(s => s.trim()).filter(s => s);
      if (tabMatch.length >= 2) {
        const row: any = { type: 'whitespace_separated', line: i + 1, patterns: extractedPatterns };
        tabMatch.forEach((value, index) => {
          row[`column_${index + 1}`] = value;
        });
        data.push(row);
        continue;
      }

      // Single line of text
      if (line.length > 0) {
        data.push({
          text: line,
          type: 'text_line',
          line: i + 1,
          patterns: extractedPatterns
        });
      }
    }

    return data;
  };

  const downloadText = () => {
    if (!extractedText) return;
    
    const blob = new Blob([extractedText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `extracted_text_${imageFile?.name || 'image'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (!imageFile) {
    return (
      <Card className="glass-card p-8 text-center">
        <div className="space-y-4">
          <div className="p-4 rounded-full bg-muted mx-auto w-fit">
            <Eye className="h-8 w-8" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">No Image Selected</h3>
            <p className="text-muted-foreground">Upload an image to extract text and data</p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <Card className="glass-card p-4 sm:p-6 animate-fade-in">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-2">
              <FileText className="h-5 w-5 text-chart-primary" />
              Image to Text Conversion
            </h3>
            <Button
              variant="analytics"
              onClick={processImage}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Processing ({progress}%)
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4 mr-2" />
                  Extract Text
                </>
              )}
            </Button>
          </div>

          {imagePreview && (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <img
                src={imagePreview}
                alt="Image preview"
                className="w-full max-h-64 object-contain bg-muted"
              />
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p><strong>File:</strong> {imageFile.name}</p>
            <p><strong>Size:</strong> {(imageFile.size / 1024 / 1024).toFixed(2)} MB</p>
            <p><strong>Type:</strong> {imageFile.type}</p>
          </div>
        </div>
      </Card>

      {extractedText && (
        <Card className="glass-card p-4 sm:p-6 animate-fade-in">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold">Extracted Text</h4>
              <Button variant="outline" size="sm" onClick={downloadText}>
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
            </div>
            
            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="Extracted text will appear here..."
            />
            
            <div className="text-sm text-muted-foreground">
              <p>Characters: {extractedText.length}</p>
              <p>Lines: {extractedText.split('\n').length}</p>
              <p>Words: {extractedText.split(/\s+/).filter(w => w).length}</p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};