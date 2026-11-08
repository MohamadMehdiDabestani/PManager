'use client';

import { useState } from 'react';
import { Plus, Trash2, ShieldAlert, CheckSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { createPmTemplateAction } from '@/app/actions/phase2-actions';

const PPE_OPTIONS = [
  'کلاه ایمنی',
  'عینک ایمنی',
  'دستکش عایق برق',
  'دستکش ضدبرش',
  'کفش ایمنی',
  'گوشی صداگیر',
  'ماسک تنفسی',
  'کمربند ایمنی (هارنس)',
  'لباس کار نسوز',
  'شیلد محافظ صورت',
];

type DraftItem = {
  id: string;
  label: string;
  type: 'BOOLEAN' | 'NUMBER' | 'TEXT' | 'PHOTO';
  unit?: string;
  minValue?: string;
  maxValue?: string;
  required: boolean;
};

export function CreatePmTemplateDialog({ plantId }: { plantId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('60');
  const [selectedPpe, setSelectedPpe] = useState<string[]>(['کلاه ایمنی', 'کفش ایمنی']);
  const [items, setItems] = useState<DraftItem[]>([
    {
      id: 'item-1',
      label: 'بازرسی ظاهری و عدم وجود نشتی یا صدای غیرعادی',
      type: 'BOOLEAN',
      required: true,
    },
  ]);

  function togglePpe(ppe: string) {
    setSelectedPpe((prev) =>
      prev.includes(ppe) ? prev.filter((p) => p !== ppe) : [...prev, ppe],
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        id: `item-${Date.now()}-${prev.length + 1}`,
        label: '',
        type: 'BOOLEAN',
        required: true,
      },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      await createPmTemplateAction({
        plantId,
        name: name.trim(),
        description: description.trim() || undefined,
        estimatedMinutes: Number(estimatedMinutes) || 60,
        requiredPpe: selectedPpe,
        checklist: items
          .filter((i) => i.label.trim().length > 0)
          .map((i) => ({
            id: i.id,
            label: i.label.trim(),
            type: i.type,
            unit: i.unit?.trim() || undefined,
            minValue: i.minValue ? Number(i.minValue) : undefined,
            maxValue: i.maxValue ? Number(i.maxValue) : undefined,
            required: i.required,
          })),
      });
      setOpen(false);
      setName('');
      setDescription('');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 me-2" />
          تعریف قالب چک‌لیست جدید
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>تعریف قالب چک‌لیست نت و الزامات ایمنی (PPE)</DialogTitle>
          <DialogDescription>
            این قالب در برنامه‌های زمان‌بندی PM استفاده می‌شود و هنگام صدور دستورکار، یک کپی ثابت (Snapshot) از آن در دستورکار ثبت می‌گردد.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-2">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-2">
              <Label htmlFor="tpl-name">عنوان قالب نت *</Label>
              <Input
                id="tpl-name"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: سرویس ماهانه پمپ هیدرولیک خط ۲"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tpl-time">زمان تخمینی (دقیقه)</Label>
              <Input
                id="tpl-time"
                type="number"
                min={5}
                dir="ltr"
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="tpl-desc">توضیحات و دستورالعمل کلی</Label>
            <Input
              id="tpl-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="نکات فنی، ابزارهای مخصوص یا شرایط توقف دستگاه..."
            />
          </div>

          <Separator />

          {/* PPE Selector */}
          <div className="space-y-2.5">
            <Label className="flex items-center gap-2 text-amber-400">
              <ShieldAlert className="h-4 w-4" />
              تجهیزات حفاظت فردی الزامی (PPE)
            </Label>
            <div className="flex flex-wrap gap-2">
              {PPE_OPTIONS.map((ppe) => {
                const active = selectedPpe.includes(ppe);
                return (
                  <button
                    key={ppe}
                    type="button"
                    onClick={() => togglePpe(ppe)}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={active ? 'warning' : 'outline'}
                      className="cursor-pointer px-3 py-1 text-xs transition-all"
                    >
                      {active ? `✓ ${ppe}` : ppe}
                    </Badge>
                  </button>
                );
              })}
            </div>
          </div>

          <Separator />

          {/* Checklist Items Builder */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4 text-primary" />
                گام‌های چک‌لیست بازرسی و سرویس ({items.length.toLocaleString('fa-IR')} مورد)
              </Label>
              <Button type="button" variant="secondary" size="sm" onClick={addItem}>
                <Plus className="h-3.5 w-3.5 me-1.5" />
                افزودن گام جدید
              </Button>
            </div>

            <div className="space-y-3">
              {items.map((item, idx) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-muted/30 p-3 space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-secondary px-2 py-1 rounded text-muted-foreground">
                      #{idx + 1}
                    </span>
                    <Input
                      required
                      value={item.label}
                      onChange={(e) => updateItem(item.id, { label: e.target.value })}
                      placeholder="شرح گام بازرسی یا اندازه‌گیری..."
                      className="flex-1 h-9"
                    />
                    <select
                      value={item.type}
                      onChange={(e) =>
                        updateItem(item.id, {
                          type: e.target.value as DraftItem['type'],
                        })
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="BOOLEAN">تایید بله/خیر (OK/NOK)</option>
                      <option value="NUMBER">مقدار عددی (کمّی)</option>
                      <option value="TEXT">یادداشت متنی</option>
                      <option value="PHOTO">ثبت عکس الزامی</option>
                    </select>
                    {items.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeItem(item.id)}
                        className="h-9 w-9 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>

                  {item.type === 'NUMBER' && (
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div>
                        <Label className="text-[11px] text-muted-foreground">واحد اندازه‌گیری</Label>
                        <Input
                          value={item.unit ?? ''}
                          onChange={(e) => updateItem(item.id, { unit: e.target.value })}
                          placeholder="bar, °C, mm/s"
                          className="h-8 text-xs mt-1"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">حداقل مجاز (Min)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={item.minValue ?? ''}
                          onChange={(e) => updateItem(item.id, { minValue: e.target.value })}
                          placeholder="0"
                          className="h-8 text-xs mt-1"
                          dir="ltr"
                        />
                      </div>
                      <div>
                        <Label className="text-[11px] text-muted-foreground">حداکثر مجاز (Max)</Label>
                        <Input
                          type="number"
                          step="any"
                          value={item.maxValue ?? ''}
                          onChange={(e) => updateItem(item.id, { maxValue: e.target.value })}
                          placeholder="100"
                          className="h-8 text-xs mt-1"
                          dir="ltr"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              انصراف
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'در حال ذخیره...' : 'ثبت قالب چک‌لیست'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
