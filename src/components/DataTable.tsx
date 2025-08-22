import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { Search, Filter, Download, TrendingUp } from 'lucide-react';

interface DataTableProps {
  data: any[];
  filename: string;
  type: string;
}

export const DataTable = ({ data, filename, type }: DataTableProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState('');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(10);

  const columns = useMemo(() => {
    if (data.length === 0) return [];
    return Object.keys(data[0]).filter(key => key && key.trim() !== '');
  }, [data]);

  const filteredData = useMemo(() => {
    return data.filter(row =>
      Object.values(row).some(value =>
        String(value).toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }, [data, searchTerm]);

  const sortedData = useMemo(() => {
    if (!sortColumn) return filteredData;
    
    return [...filteredData].sort((a, b) => {
      const aVal = a[sortColumn];
      const bVal = b[sortColumn];
      
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }
      
      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      
      if (sortDirection === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [filteredData, sortColumn, sortDirection]);

  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedData.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedData, currentPage, rowsPerPage]);

  const totalPages = Math.ceil(sortedData.length / rowsPerPage);

  const getColumnType = (column: string) => {
    const sample = data.slice(0, 100);
    const values = sample.map(row => row[column]).filter(v => v != null);
    
    if (values.every(v => !isNaN(Number(v)))) return 'number';
    if (values.every(v => !isNaN(Date.parse(v)))) return 'date';
    return 'text';
  };

  const getColumnStats = (column: string) => {
    const values = data.map(row => row[column]).filter(v => v != null);
    const unique = new Set(values).size;
    const filled = values.length;
    const total = data.length;
    
    return {
      unique,
      filled,
      total,
      completion: Math.round((filled / total) * 100)
    };
  };

  const handleExport = () => {
    if (data.length === 0) return;
    
    // Convert data to CSV
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => 
        headers.map(header => {
          const value = row[header];
          // Escape commas and quotes in values
          if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
            return `"${value.replace(/"/g, '""')}"`;
          }
          return value ?? '';
        }).join(',')
      )
    ].join('\n');
    
    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename.replace(/\.[^/.]+$/, '')}_export.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({
      title: "Export Complete",
      description: `${data.length} rows exported to CSV file.`,
    });
  };


  if (data.length === 0) {
    return (
      <Card className="glass-card p-8 text-center">
        <p className="text-muted-foreground">No data to display</p>
      </Card>
    );
  }

  return (
    <Card className="glass-card p-3 sm:p-6 space-y-4 sm:space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h3 className="text-base sm:text-xl font-semibold flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-chart-primary" />
            <span className="truncate">{filename}</span>
          </h3>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {data.length} rows, {columns.length} columns • Type: {type.toUpperCase()}
          </p>
        </div>
        
        <div className="flex gap-2 flex-shrink-0 w-full sm:w-auto">
          <Button variant="glass" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" />
            <span className="ml-2">Export</span>
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search data..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <Select value={sortColumn} onValueChange={setSortColumn}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sort by column" />
          </SelectTrigger>
          <SelectContent>
            {columns.map(column => (
              <SelectItem key={column} value={column}>
                {column}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border/50 overflow-hidden overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              {columns.map(column => {
                const stats = getColumnStats(column);
                const type = getColumnType(column);
                
                return (
                  <TableHead 
                    key={column}
                    className="cursor-pointer hover:bg-muted/70 transition-colors p-2 sm:p-4 min-w-[120px]"
                    onClick={() => {
                      if (sortColumn === column) {
                        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
                      } else {
                        setSortColumn(column);
                        setSortDirection('asc');
                      }
                    }}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{column}</span>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-xs">
                            {type}
                          </Badge>
                          {sortColumn === column && (
                            <Badge variant="default" className="text-xs">
                              {sortDirection === 'asc' ? '↑' : '↓'}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground whitespace-nowrap">
                        {stats.completion}% filled • {stats.unique} unique
                      </div>
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedData.map((row, index) => (
              <TableRow key={index} className="hover:bg-muted/30">
                {columns.map(column => (
                  <TableCell key={column} className="p-2 sm:p-4">
                    <div className="max-w-xs truncate">
                      {row[column] != null ? (
                        typeof row[column] === 'object' 
                          ? JSON.stringify(row[column])
                          : String(row[column])
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-2 sm:px-0">
          <p className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
            Showing {((currentPage - 1) * rowsPerPage) + 1} to {Math.min(currentPage * rowsPerPage, sortedData.length)} of {sortedData.length} results
          </p>
          
          <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto justify-center">
            <Button 
              variant="outline" 
              size="sm"
              className="px-2 sm:px-4"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage(currentPage - 1)}
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Button>
            
            <div className="flex gap-1 overflow-x-auto">
              {Array.from({ length: Math.min(3, totalPages) }, (_, i) => {
                let page;
                if (totalPages <= 3) {
                  page = i + 1;
                } else if (currentPage <= 2) {
                  page = i + 1;
                } else if (currentPage >= totalPages - 1) {
                  page = totalPages - 2 + i;
                } else {
                  page = currentPage - 1 + i;
                }
                
                return (
                  <Button
                    key={page}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    className="w-8 h-8 p-0 flex-shrink-0"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </Button>
                );
              })}
            </div>
            
            <Button 
              variant="outline" 
              size="sm"
              className="px-2 sm:px-4"
              disabled={currentPage === totalPages}
              onClick={() => setCurrentPage(currentPage + 1)}
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
};