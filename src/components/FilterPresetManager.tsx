import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { Save, Bookmark, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterPreset {
  id: string;
  preset_name: string;
  filter_data: any;
  is_default: boolean;
}

interface FilterPresetManagerProps {
  filterType: 'survey_analysis' | 'survey_results' | 'survey_management';
  currentFilters: any;
  onLoadPreset: (filters: any) => void;
  filterLabels?: Record<string, string>;
  filterDisplayValues?: Record<string, unknown>;
  onRemoveFilter?: (key: string) => void;
  className?: string;
}

export const FilterPresetManager = ({
  filterType,
  currentFilters,
  onLoadPreset,
  filterLabels,
  filterDisplayValues,
  onRemoveFilter,
  className,
}: FilterPresetManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [presets, setPresets] = useState<FilterPreset[]>([]);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [presetName, setPresetName] = useState('');
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  useEffect(() => {
    if (user) {
      fetchPresets();
    }
  }, [user, filterType]);

  const fetchPresets = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_filter_presets')
        .select('*')
        .eq('user_id', user.id)
        .eq('filter_type', filterType)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPresets(data || []);
    } catch (error) {
      console.error('Error fetching presets:', error);
    }
  };

  const savePreset = async () => {
    if (!user || !presetName.trim()) return;

    try {
      const { error } = await supabase
        .from('user_filter_presets')
        .insert({
          user_id: user.id,
          preset_name: presetName.trim(),
          filter_type: filterType,
          filter_data: currentFilters,
          is_default: false
        });

      if (error) throw error;

      toast({
        title: "성공",
        description: "필터 프리셋이 저장되었습니다."
      });

      setPresetName('');
      setSaveDialogOpen(false);
      fetchPresets();
    } catch (error: any) {
      toast({
        title: "오류",
        description: error.message.includes('duplicate') 
          ? "같은 이름의 프리셋이 이미 존재합니다."
          : "프리셋 저장 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const loadPreset = (presetId: string) => {
    const preset = presets.find(p => p.id === presetId);
    if (preset) {
      onLoadPreset(preset.filter_data);
      toast({
        title: "성공",
        description: `"${preset.preset_name}" 프리셋이 적용되었습니다.`
      });
    }
  };

  const deletePreset = async (presetId: string) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까?')) return;

    try {
      const { error } = await supabase
        .from('user_filter_presets')
        .delete()
        .eq('id', presetId);

      if (error) throw error;

      toast({
        title: "성공",
        description: "프리셋이 삭제되었습니다."
      });

      fetchPresets();
      if (selectedPreset === presetId) {
        setSelectedPreset('');
      }
    } catch (error) {
      toast({
        title: "오류",
        description: "프리셋 삭제 중 오류가 발생했습니다.",
        variant: "destructive"
      });
    }
  };

  const isDefaultValue = (value: unknown) => {
    if (value === undefined || value === null) return true;
    if (Array.isArray(value)) {
      if (!value.length) return true;
      return value.every((item) => isDefaultValue(item));
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      return normalized === '' || normalized === 'all' || normalized === '전체';
    }
    return false;
  };

  const formatDisplayValue = (value: unknown) => {
    if (value === undefined || value === null) return '';
    if (Array.isArray(value)) {
      return value.filter((item) => !isDefaultValue(item)).join(', ');
    }
    if (typeof value === 'object') {
      try {
        return Object.values(value as Record<string, unknown>)
          .filter((item) => !isDefaultValue(item))
          .join(', ');
      } catch (error) {
        console.warn('Failed to format filter display value:', error);
        return String(value);
      }
    }
    return String(value);
  };

  const summaryBadges = useMemo(() => {
    const keys = new Set<string>();
    Object.keys(currentFilters || {}).forEach((key) => keys.add(key));
    Object.keys(filterDisplayValues || {}).forEach((key) => keys.add(key));

    return Array.from(keys)
      .map((key) => {
        const rawValue = currentFilters?.[key];
        const displayValue = filterDisplayValues?.[key] ?? rawValue;

        if (isDefaultValue(rawValue) && isDefaultValue(displayValue)) {
          return null;
        }

        const valueText = formatDisplayValue(displayValue);
        if (!valueText) {
          return null;
        }

        return {
          key,
          label: filterLabels?.[key] ?? key,
          value: valueText,
        };
      })
      .filter((item): item is { key: string; label: string; value: string } => Boolean(item));
  }, [currentFilters, filterDisplayValues, filterLabels]);

  return (
    <div className={cn('flex flex-col gap-3 md:flex-row md:items-center md:gap-4', className)}>
      {summaryBadges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {summaryBadges.map((item) => (
            <Badge
              key={item.key}
              variant="secondary"
              className="flex items-center gap-1 pl-2 pr-1 py-1 text-xs font-medium"
            >
              <span className="text-muted-foreground">{item.label}</span>
              <span className="text-foreground">{item.value}</span>
              {onRemoveFilter && (
                <button
                  type="button"
                  onClick={() => onRemoveFilter(item.key)}
                  className="ml-1 rounded-full p-0.5 transition-colors hover:bg-muted"
                  aria-label={`${item.label} 필터 해제`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 md:ml-auto">
        {presets.length > 0 && (
          <div className="flex items-center gap-2">
            <Select
              value={selectedPreset}
              onValueChange={(value) => {
                setSelectedPreset(value);
                if (value) loadPreset(value);
              }}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder="저장된 필터 선택" />
              </SelectTrigger>
              <SelectContent>
                {presets.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    <div className="flex items-center gap-2">
                      <Bookmark className="h-3 w-3" />
                      {preset.preset_name}
                      {preset.is_default && <span className="text-xs text-primary">(기본)</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedPreset && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => deletePreset(selectedPreset)}
                className="p-2"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}

        <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              <Save className="h-4 w-4 mr-2" />
              필터 저장
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>필터 프리셋 저장</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="preset-name">프리셋 이름</Label>
                <Input
                  id="preset-name"
                  value={presetName}
                  onChange={(e) => setPresetName(e.target.value)}
                  placeholder="예: 2024년 1차 설문"
                  className="mt-1"
                />
              </div>
              <div className="text-sm text-muted-foreground">
                현재 선택된 필터 설정이 저장됩니다:
                <ul className="mt-2 space-y-1">
                  {Object.entries(currentFilters || {}).map(([key, value]) => (
                    <li key={key} className="flex justify-between">
                      <span className="font-medium">{key}:</span>
                      <span>{String(value) || '전체'}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  취소
                </Button>
                <Button onClick={savePreset} disabled={!presetName.trim()}>
                  저장
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};