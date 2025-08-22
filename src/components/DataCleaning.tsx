import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { CheckCircle, AlertTriangle, Trash2, Sparkles } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataCleaningProps {
  data: any[];
  onDataCleaned: (cleanedData: any[]) => void;
}

export const DataCleaning = ({ data, onDataCleaned }: DataCleaningProps) => {
  const [cleaningOptions, setCleaningOptions] = useState({
    removeEmptyRows: true,
    trimWhitespace: true,
    removeSpecialChars: false,
    standardizeText: true,
    removeDuplicates: true,
    handleMissingValues: true,
    smartOrganization: false,
    groupEmails: false,
    groupPhones: false,
    groupLocations: false
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [cleaningStats, setCleaningStats] = useState<any>(null);
  const [detectedPatterns, setDetectedPatterns] = useState<any>({});
  const { toast } = useToast();

  // Enhanced pattern detection
  const detectDataPatterns = (data: any[]) => {
    if (data.length === 0) return {};
    
    const columns = Object.keys(data[0]);
    const patterns = {
      emails: [],
      phones: [],
      locations: [],
      dates: [],
      numbers: []
    };
    
    columns.forEach(col => {
      const sample = data.slice(0, 50).map(row => row[col]).filter(val => val);
      
      // Email detection
      const emailCount = sample.filter(val => /\S+@\S+\.\S+/.test(String(val))).length;
      if (emailCount > sample.length * 0.3) {
        patterns.emails.push({ column: col, confidence: (emailCount / sample.length * 100).toFixed(0) });
      }
      
      // Phone detection
      const phoneCount = sample.filter(val => 
        /^[\+]?[1-9]?[\d\s\-\(\)]{7,15}$/.test(String(val).trim()) ||
        /^\d{3}-\d{3}-\d{4}$/.test(String(val).trim()) ||
        /^\(\d{3}\)\s?\d{3}-\d{4}$/.test(String(val).trim())
      ).length;
      if (phoneCount > sample.length * 0.3) {
        patterns.phones.push({ column: col, confidence: (phoneCount / sample.length * 100).toFixed(0) });
      }
      
      // Location detection
      const locationKeywords = ['street', 'city', 'state', 'country', 'address', 'location', 'zip', 'postal'];
      const hasLocationKeyword = locationKeywords.some(keyword => col.toLowerCase().includes(keyword));
      const addressCount = sample.filter(val => 
        /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd)/i.test(String(val)) ||
        /\b\d{5}(-\d{4})?\b/.test(String(val)) // ZIP codes
      ).length;
      
      if (hasLocationKeyword || addressCount > sample.length * 0.2) {
        patterns.locations.push({ column: col, confidence: Math.max(hasLocationKeyword ? 80 : 0, (addressCount / sample.length * 100)).toFixed(0) });
      }
    });
    
    return patterns;
  };
  // Helper functions for Smart Organization
  const detectMoney = (value: string): { isMoney: boolean; amount: number | null; currency: string } => {
    if (typeof value !== 'string') return { isMoney: false, amount: null, currency: '' };
    
    const moneyRegex = /[\$₦€£¥₹₽¢₩₪₫₡₨₵₴₸₲₱₦₹₽]/;
    const cleanValue = value.trim();
    
    if (moneyRegex.test(cleanValue)) {
      const currency = cleanValue.match(moneyRegex)?.[0] || '';
      const numericPart = cleanValue.replace(/[^\d.,]/g, '').replace(/,/g, '');
      const amount = parseFloat(numericPart);
      
      return {
        isMoney: !isNaN(amount),
        amount: !isNaN(amount) ? amount : null,
        currency
      };
    }
    
    return { isMoney: false, amount: null, currency: '' };
  };

  // Enhanced email grouping
  const groupEmails = (data: any[]): any[] => {
    const emailRegex = /\S+@\S+\.\S+/g;
    
    return data.map(row => {
      const newRow = { ...row };
      let foundEmails = [];
      
      Object.keys(row).forEach(key => {
        const value = String(row[key] || '');
        const emails = value.match(emailRegex);
        if (emails) {
          foundEmails.push(...emails);
          // Clear original field if it only contained email
          if (emails.join(', ') === value.trim()) {
            newRow[key] = '';
          }
        }
      });
      
      if (foundEmails.length > 0) {
        newRow['Email'] = foundEmails.join(', ');
      }
      
      return newRow;
    });
  };

  // Enhanced phone grouping
  const groupPhones = (data: any[]): any[] => {
    const phoneRegex = /[\+]?[1-9]?[\d\s\-\(\)]{7,15}/g;
    
    return data.map(row => {
      const newRow = { ...row };
      let foundPhones = [];
      
      Object.keys(row).forEach(key => {
        const value = String(row[key] || '');
        const phones = value.match(phoneRegex);
        if (phones) {
          // Validate and clean phone numbers
          const validPhones = phones.filter(phone => {
            const cleaned = phone.replace(/\D/g, '');
            return cleaned.length >= 7 && cleaned.length <= 15;
          });
          
          if (validPhones.length > 0) {
            foundPhones.push(...validPhones);
            // Clear original field if it only contained phone
            if (validPhones.join(', ') === value.trim()) {
              newRow[key] = '';
            }
          }
        }
      });
      
      if (foundPhones.length > 0) {
        newRow['Phone'] = foundPhones.join(', ');
      }
      
      return newRow;
    });
  };

  // Enhanced location grouping
  const groupLocations = (data: any[]): any[] => {
    return data.map(row => {
      const newRow = { ...row };
      let foundLocations = [];
      
      Object.keys(row).forEach(key => {
        const value = String(row[key] || '');
        const lowerKey = key.toLowerCase();
        
        // Check for location keywords or address patterns
        if (lowerKey.includes('address') || lowerKey.includes('location') || 
            lowerKey.includes('city') || lowerKey.includes('state') ||
            /\d+\s+\w+\s+(street|st|avenue|ave|road|rd|drive|dr|lane|ln|way|blvd)/i.test(value) ||
            /\b\d{5}(-\d{4})?\b/.test(value)) {
          
          foundLocations.push(value);
          newRow[key] = ''; // Clear original field
        }
      });
      
      if (foundLocations.length > 0) {
        newRow['Location'] = foundLocations.join(', ');
      }
      
      return newRow;
    });
  };
  const detectDate = (value: string): { isDate: boolean; standardDate: string | null } => {
    if (typeof value !== 'string') return { isDate: false, standardDate: null };
    
    const cleanValue = value.trim();
    
    // Try various date formats
    const dateFormats = [
      /^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
      /^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
      /^\d{2}-\d{2}-\d{4}$/, // MM-DD-YYYY
      /^\d{4}\/\d{2}\/\d{2}$/, // YYYY/MM/DD
      /^\d{1,2}\/\d{1,2}\/\d{4}$/, // M/D/YYYY
      /^\d{1,2}-\d{1,2}-\d{4}$/, // M-D-YYYY
    ];
    
    const isDateFormat = dateFormats.some(format => format.test(cleanValue));
    
    if (isDateFormat || !isNaN(Date.parse(cleanValue))) {
      const date = new Date(cleanValue);
      if (!isNaN(date.getTime())) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return {
          isDate: true,
          standardDate: `${year}-${month}-${day}`
        };
      }
    }
    
    return { isDate: false, standardDate: null };
  };

  const detectNumeric = (value: string): { isNumeric: boolean; numericValue: number | null } => {
    if (typeof value !== 'string') return { isNumeric: false, numericValue: null };
    
    const cleanValue = value.trim().replace(/,/g, '');
    
    // Check if it's a pure number (not money or date)
    if (/^-?\d*\.?\d+$/.test(cleanValue)) {
      const num = parseFloat(cleanValue);
      return {
        isNumeric: !isNaN(num),
        numericValue: !isNaN(num) ? num : null
      };
    }
    
    return { isNumeric: false, numericValue: null };
  };

  const applySmartOrganization = (data: any[]): any[] => {
    if (data.length === 0) return data;
    
    const organizedData: any[] = [];
    
    data.forEach((row, rowIndex) => {
      const newRow: any = {};
      let hasMoneyInRow = false;
      let hasDateInRow = false;
      
      // First pass: identify and extract special values
      Object.keys(row).forEach(key => {
        const value = row[key];
        const stringValue = String(value || '').trim();
        
        if (!stringValue) {
          newRow[key] = value;
          return;
        }
        
        // Check for money
        const moneyCheck = detectMoney(stringValue);
        if (moneyCheck.isMoney && moneyCheck.amount !== null) {
          if (!hasMoneyInRow) {
            newRow['Money'] = `${moneyCheck.currency}${moneyCheck.amount}`;
            hasMoneyInRow = true;
          }
          // Remove from original column or mark as processed
          newRow[key] = '';
          return;
        }
        
        // Check for dates
        const dateCheck = detectDate(stringValue);
        if (dateCheck.isDate && dateCheck.standardDate) {
          if (!hasDateInRow) {
            newRow['Date'] = dateCheck.standardDate;
            hasDateInRow = true;
          }
          // Remove from original column or mark as processed
          newRow[key] = '';
          return;
        }
        
        // Check for numeric values
        const numericCheck = detectNumeric(stringValue);
        if (numericCheck.isNumeric && numericCheck.numericValue !== null) {
          newRow[key] = numericCheck.numericValue;
          return;
        }
        
        // Keep as text
        newRow[key] = value;
      });
      
      organizedData.push(newRow);
    });
    
    // Clean up empty columns
    const finalData = organizedData.map(row => {
      const cleanedRow: any = {};
      Object.keys(row).forEach(key => {
        if (row[key] !== '' && row[key] !== null && row[key] !== undefined) {
          cleanedRow[key] = row[key];
        }
      });
      return cleanedRow;
    });
    
    return finalData;
  };

  const analyzeDataQuality = () => {
    setIsAnalyzing(true);
    
    setTimeout(() => {
      const patterns = detectDataPatterns(data);
      setDetectedPatterns(patterns);
      
      const stats = {
        totalRows: data.length,
        emptyRows: data.filter(row => Object.values(row).every(val => !val || String(val).trim() === '')).length,
        duplicateRows: data.length - new Set(data.map(row => JSON.stringify(row))).size,
        whitespaceIssues: data.reduce((count, row) => 
          count + Object.values(row).filter(val => 
            typeof val === 'string' && (val.startsWith(' ') || val.endsWith(' '))
          ).length, 0
        ),
        missingValues: data.reduce((count, row) => 
          count + Object.values(row).filter(val => val === null || val === undefined || val === '').length, 0
        ),
        patterns
      };
      
      setCleaningStats(stats);
      setIsAnalyzing(false);
    }, 1500);
  };

  const cleanData = () => {
    let cleaned = [...data];
    let changes = 0;
    let operationsPerformed = [];

    // Apply enhanced grouping options first
    if (cleaningOptions.groupEmails) {
      cleaned = groupEmails(cleaned);
      const emailCount = cleaned.filter(row => row['Email']).length;
      if (emailCount > 0) operationsPerformed.push(`Grouped ${emailCount} email addresses`);
    }

    if (cleaningOptions.groupPhones) {
      cleaned = groupPhones(cleaned);
      const phoneCount = cleaned.filter(row => row['Phone']).length;
      if (phoneCount > 0) operationsPerformed.push(`Grouped ${phoneCount} phone numbers`);
    }

    if (cleaningOptions.groupLocations) {
      cleaned = groupLocations(cleaned);
      const locationCount = cleaned.filter(row => row['Location']).length;
      if (locationCount > 0) operationsPerformed.push(`Grouped ${locationCount} location entries`);
    }
    if (cleaningOptions.removeEmptyRows) {
      const before = cleaned.length;
      cleaned = cleaned.filter(row => 
        !Object.values(row).every(val => !val || String(val).trim() === '')
      );
      const removed = before - cleaned.length;
      changes += removed;
      if (removed > 0) operationsPerformed.push(`Removed ${removed} empty rows`);
    }

    if (cleaningOptions.removeDuplicates) {
      const before = cleaned.length;
      const seen = new Set();
      cleaned = cleaned.filter(row => {
        const key = JSON.stringify(row);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      const removed = before - cleaned.length;
      changes += removed;
      if (removed > 0) operationsPerformed.push(`Removed ${removed} duplicate rows`);
    }

    if (cleaningOptions.trimWhitespace || cleaningOptions.standardizeText || cleaningOptions.removeSpecialChars) {
      let cellsModified = 0;
      cleaned = cleaned.map(row => {
        const newRow = { ...row };
        Object.keys(newRow).forEach(key => {
          if (typeof newRow[key] === 'string') {
            const originalValue = newRow[key];
            
            if (cleaningOptions.trimWhitespace) {
              newRow[key] = newRow[key].trim();
            }
            
            if (cleaningOptions.standardizeText) {
              newRow[key] = newRow[key].replace(/\s+/g, ' ');
            }
            
            if (cleaningOptions.removeSpecialChars) {
              // Essential characters to preserve: letters, numbers, spaces, commas, periods, @, hyphens, underscores
              // Remove special characters but preserve essential ones
              let cleanedValue = newRow[key].replace(/[^\w\s,.\-@]/g, '');
              
              // Remove duplicate essential characters (but keep at least one)
              // Remove duplicate spaces
              cleanedValue = cleanedValue.replace(/\s{2,}/g, ' ');
              // Remove duplicate commas
              cleanedValue = cleanedValue.replace(/,{2,}/g, ',');
              // Remove duplicate periods
              cleanedValue = cleanedValue.replace(/\.{2,}/g, '.');
              // Remove duplicate @ symbols
              cleanedValue = cleanedValue.replace(/@{2,}/g, '@');
              // Remove duplicate hyphens
              cleanedValue = cleanedValue.replace(/-{2,}/g, '-');
              // Remove duplicate underscores
              cleanedValue = cleanedValue.replace(/_{2,}/g, '_');
              
              newRow[key] = cleanedValue;
            }
            
            if (originalValue !== newRow[key]) {
              cellsModified++;
            }
          }
        });
        return newRow;
      });
      
      if (cleaningOptions.trimWhitespace && cellsModified > 0) {
        operationsPerformed.push(`Trimmed whitespace in ${cellsModified} cells`);
      }
      if (cleaningOptions.standardizeText && cellsModified > 0) {
        operationsPerformed.push(`Standardized text spacing`);
      }
      if (cleaningOptions.removeSpecialChars && cellsModified > 0) {
        operationsPerformed.push(`Cleaned special characters in ${cellsModified} cells`);
      }
    }

    if (cleaningOptions.handleMissingValues) {
      let missingValuesHandled = 0;
      cleaned = cleaned.map(row => {
        const newRow = { ...row };
        Object.keys(newRow).forEach(key => {
          if (newRow[key] === null || newRow[key] === undefined || newRow[key] === '') {
            newRow[key] = 'N/A';
            missingValuesHandled++;
          }
        });
        return newRow;
      });
      if (missingValuesHandled > 0) {
        operationsPerformed.push(`Handled ${missingValuesHandled} missing values`);
      }
    }

    // Apply Smart Organization if selected
    if (cleaningOptions.smartOrganization) {
      const beforeColumns = Object.keys(cleaned[0] || {}).length;
      cleaned = applySmartOrganization(cleaned);
      const afterColumns = Object.keys(cleaned[0] || {}).length;
      
      operationsPerformed.push(`Applied smart organization - restructured data with ${afterColumns} columns`);
      
      // Count organized values
      const moneyCount = cleaned.filter(row => row['Money']).length;
      const dateCount = cleaned.filter(row => row['Date']).length;
      
      if (moneyCount > 0) operationsPerformed.push(`Organized ${moneyCount} money values`);
      if (dateCount > 0) operationsPerformed.push(`Standardized ${dateCount} date values`);
    }
    onDataCleaned(cleaned);
    toast({
      title: "Data Cleaned Successfully!",
      description: operationsPerformed.length > 0 
        ? operationsPerformed.join('. ') + '.'
        : `Processed ${data.length} rows with selected cleaning options.`,
    });
  };

  return (
    <div className="space-y-6 px-2 sm:px-0">
      <Card className="floating-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-lg sm:text-2xl">
            <Sparkles className="h-6 w-6 text-chart-primary" />
            Data Quality Analysis
          </CardTitle>
          <CardDescription>
            Analyze and clean your dataset to improve data quality
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!cleaningStats && (
            <div className="text-center py-8">
              <Button 
                onClick={analyzeDataQuality} 
                disabled={isAnalyzing}
                className="bg-gradient-to-r from-chart-primary to-chart-secondary hover:opacity-90"
              >
                {isAnalyzing ? 'Analyzing...' : 'Analyze Data Quality'}
              </Button>
              {isAnalyzing && (
                <div className="mt-4 space-y-2">
                  <Progress value={66} className="w-full" />
                  <p className="text-sm text-muted-foreground">Scanning for data quality issues...</p>
                </div>
              )}
            </div>
          )}

          {cleaningStats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-gradient-to-br from-background to-muted/50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-chart-primary">{cleaningStats.totalRows}</div>
                  <div className="text-sm text-muted-foreground">Total Rows</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-background to-muted/50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-chart-warning">{cleaningStats.emptyRows}</div>
                  <div className="text-sm text-muted-foreground">Empty Rows</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-background to-muted/50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-chart-secondary">{cleaningStats.duplicateRows}</div>
                  <div className="text-sm text-muted-foreground">Duplicates</div>
                </div>
                <div className="text-center p-4 bg-gradient-to-br from-background to-muted/50 rounded-lg">
                  <div className="text-xl sm:text-2xl font-bold text-chart-tertiary">{cleaningStats.missingValues}</div>
                  <div className="text-sm text-muted-foreground">Missing Values</div>
                </div>
              </div>

              {/* Pattern Detection Results */}
              {(detectedPatterns.emails?.length > 0 || detectedPatterns.phones?.length > 0 || detectedPatterns.locations?.length > 0) && (
                <>
                  <Separator />
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-chart-primary" />
                      Smart Pattern Detection
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {detectedPatterns.emails?.length > 0 && (
                        <div className="p-3 bg-gradient-to-br from-chart-primary/10 to-chart-primary/5 rounded-lg border border-chart-primary/20">
                          <div className="font-medium text-chart-primary mb-1">📧 Email Addresses</div>
                          <div className="text-sm text-muted-foreground">
                            {detectedPatterns.emails.map((item: any) => (
                              <div key={item.column}>{item.column} ({item.confidence}% confidence)</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {detectedPatterns.phones?.length > 0 && (
                        <div className="p-3 bg-gradient-to-br from-chart-secondary/10 to-chart-secondary/5 rounded-lg border border-chart-secondary/20">
                          <div className="font-medium text-chart-secondary mb-1">📞 Phone Numbers</div>
                          <div className="text-sm text-muted-foreground">
                            {detectedPatterns.phones.map((item: any) => (
                              <div key={item.column}>{item.column} ({item.confidence}% confidence)</div>
                            ))}
                          </div>
                        </div>
                      )}
                      {detectedPatterns.locations?.length > 0 && (
                        <div className="p-3 bg-gradient-to-br from-chart-tertiary/10 to-chart-tertiary/5 rounded-lg border border-chart-tertiary/20">
                          <div className="font-medium text-chart-tertiary mb-1">📍 Locations</div>
                          <div className="text-sm text-muted-foreground">
                            {detectedPatterns.locations.map((item: any) => (
                              <div key={item.column}>{item.column} ({item.confidence}% confidence)</div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
              <Separator />

              <div>
                <h3 className="text-base sm:text-lg font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                  Cleaning Options
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                  {Object.entries({
                    removeEmptyRows: 'Remove Empty Rows',
                    trimWhitespace: 'Trim Whitespace',
                    standardizeText: 'Standardize Text Spacing',
                    removeDuplicates: 'Remove Duplicate Rows',
                    handleMissingValues: 'Handle Missing Values',
                    removeSpecialChars: 'Remove Special Characters',
                    smartOrganization: 'Smart Organization (Money, Dates, Numbers)',
                    groupEmails: 'Group Email Addresses',
                    groupPhones: 'Group Phone Numbers', 
                    groupLocations: 'Group Location Data'
                  }).map(([key, label], index) => (
                    <div key={key} className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                      <Checkbox
                        id={key}
                        checked={cleaningOptions[key as keyof typeof cleaningOptions]}
                        onCheckedChange={(checked) =>
                          setCleaningOptions(prev => ({ ...prev, [key]: checked }))
                        }
                        disabled={
                          (key === 'groupEmails' && detectedPatterns.emails?.length === 0) ||
                          (key === 'groupPhones' && detectedPatterns.phones?.length === 0) ||
                          (key === 'groupLocations' && detectedPatterns.locations?.length === 0)
                        }
                      />
                      <label htmlFor={key} className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1">
                        {label}
                        {key === 'smartOrganization' && (
                          <span className="block text-xs text-muted-foreground mt-1">
                            Automatically detects and organizes money ($, €, £), dates (YYYY-MM-DD), and numeric values into proper columns
                          </span>
                        )}
                        {key === 'groupEmails' && detectedPatterns.emails?.length === 0 && (
                          <span className="block text-xs text-muted-foreground mt-1">
                            No email patterns detected in your data
                          </span>
                        )}
                        {key === 'groupPhones' && detectedPatterns.phones?.length === 0 && (
                          <span className="block text-xs text-muted-foreground mt-1">
                            No phone number patterns detected in your data
                          </span>
                        )}
                        {key === 'groupLocations' && detectedPatterns.locations?.length === 0 && (
                          <span className="block text-xs text-muted-foreground mt-1">
                            No location patterns detected in your data
                          </span>
                        )}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-center pt-4">
                <Button 
                  onClick={cleanData}
                  className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 px-8"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  Clean Data
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};