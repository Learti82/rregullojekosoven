"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { Lightbulb, Send } from "lucide-react";
import { toast } from "sonner";
import { suggestCategory } from "@/lib/ai/classifier";
import { useDebounce } from "@/hooks/use-debounce";
import { fieldError } from "@/hooks/use-action-state";
import { createReportAction } from "@/server/actions/reports";
import type { ReportImageInput } from "@/validations/report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FieldError, FormMessage } from "@/components/ui/form-error";
import { ImageUploader } from "@/components/uploads/image-uploader";
import { LocationPicker } from "@/components/map/dynamic-map";
import type { PickedLocation } from "@/types";

type Option = { id: string; name: string; slug: string; color?: string; description?: string | null };

const TITLE_MAX = 160;
const DESCRIPTION_MAX = 5000;

export function CreateReportForm({
  municipalities,
  categories,
  defaultMunicipalityId,
  uploadsEnabled,
}: {
  municipalities: Option[];
  categories: Option[];
  defaultMunicipalityId?: string;
  uploadsEnabled: boolean;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createReportAction, null);

  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [categoryId, setCategoryId] = React.useState("");
  const [municipalityId, setMunicipalityId] = React.useState(defaultMunicipalityId ?? "");
  const [priority, setPriority] = React.useState("MEDIUM");
  const [location, setLocation] = React.useState<PickedLocation | null>(null);
  const [images, setImages] = React.useState<ReportImageInput[]>([]);

  React.useEffect(() => {
    if (state?.success) {
      toast.success(state.message ?? "Raporti u dërgua për shqyrtim.");
      router.push(`/reports/${state.data.slug}`);
    }
  }, [state, router]);

  // Live category hint from the same heuristic the server records.
  const debouncedText = useDebounce(`${title} ${description}`, 600);
  const suggestion = React.useMemo(() => {
    if (debouncedText.trim().length < 15) return null;
    const guess = suggestCategory(debouncedText);
    if (!guess) return null;
    const match = categories.find((category) => category.slug === guess.slug);
    return match && match.id !== categoryId ? match : null;
  }, [debouncedText, categories, categoryId]);

  const handleSubmit = (formData: FormData) => {
    if (!location) {
      toast.error("Zgjidhni vendndodhjen e problemit në hartë.");
      return;
    }
    formData.set("latitude", String(location.lat));
    formData.set("longitude", String(location.lng));
    formData.set("images", JSON.stringify(images));
    formAction(formData);
  };

  return (
    <form action={handleSubmit} className="space-y-6" noValidate>
      {state && !state.success ? <FormMessage>{state.error}</FormMessage> : null}

      <Card>
        <CardHeader>
          <CardTitle>Çfarë problemi po raportoni?</CardTitle>
          <CardDescription>Një titull i qartë ndihmon komunën ta kuptojë menjëherë.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="title">Titulli</Label>
            <Input
              id="title"
              name="title"
              required
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, TITLE_MAX))}
              placeholder="P.sh. Gropë e madhe në rrugën 'Nëna Terezë'"
              aria-invalid={Boolean(fieldError(state, "title"))}
              aria-describedby="title-error"
            />
            <div className="flex justify-between gap-2">
              <FieldError id="title-error" messages={fieldError(state, "title")} />
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {title.length}/{TITLE_MAX}
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Përshkrimi</Label>
            <Textarea
              id="description"
              name="description"
              required
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value.slice(0, DESCRIPTION_MAX))}
              placeholder="Përshkruani problemin: sa kohë ekziston, kë e prek, sa i rrezikshëm është…"
              aria-invalid={Boolean(fieldError(state, "description"))}
              aria-describedby="description-error"
            />
            <div className="flex justify-between gap-2">
              <FieldError id="description-error" messages={fieldError(state, "description")} />
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {description.length}/{DESCRIPTION_MAX}
              </span>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="categoryId">Kategoria</Label>
              <Select value={categoryId} onValueChange={setCategoryId} required>
                <SelectTrigger id="categoryId" aria-describedby="category-error">
                  <SelectValue placeholder="Zgjidhni kategorinë" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((category) => (
                    <SelectItem key={category.id} value={category.id}>
                      <span className="flex items-center gap-2">
                        <span
                          className="size-2.5 rounded-full"
                          style={{ backgroundColor: category.color }}
                          aria-hidden
                        />
                        {category.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="categoryId" value={categoryId} />
              <FieldError id="category-error" messages={fieldError(state, "categoryId")} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="municipalityId">Komuna</Label>
              <Select value={municipalityId} onValueChange={setMunicipalityId} required>
                <SelectTrigger id="municipalityId" aria-describedby="municipality-error">
                  <SelectValue placeholder="Zgjidhni komunën" />
                </SelectTrigger>
                <SelectContent>
                  {municipalities.map((municipality) => (
                    <SelectItem key={municipality.id} value={municipality.id}>
                      {municipality.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="municipalityId" value={municipalityId} />
              <FieldError id="municipality-error" messages={fieldError(state, "municipalityId")} />
            </div>
          </div>

          {suggestion ? (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 text-sm">
              <Lightbulb className="size-4 shrink-0 text-primary" aria-hidden />
              <span className="flex-1">
                Nga përshkrimi duket si <strong>{suggestion.name}</strong>.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setCategoryId(suggestion.id)}
              >
                Përdore
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ku ndodhet problemi?</CardTitle>
          <CardDescription>
            Klikoni në hartë ose përdorni vendndodhjen tuaj. Pini mund të zhvendoset.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LocationPicker value={location} onChange={setLocation} />

          <div className="space-y-1.5">
            <Label htmlFor="address">Adresa ose përshkrimi i vendit (opsional)</Label>
            <Input
              id="address"
              name="address"
              placeholder="P.sh. afër shkollës 'Dardania', hyrja veriore"
              maxLength={255}
            />
          </div>
        </CardContent>
      </Card>

      {uploadsEnabled ? (
        <Card>
          <CardHeader>
            <CardTitle>Foto</CardTitle>
            <CardDescription>
              Fotot e bëjnë raportin shumë më bindës dhe e shpejtojnë verifikimin.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ImageUploader onChange={setImages} label="Foto të problemit" />
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Detaje shtesë</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="priority">Sa urgjent është?</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger id="priority">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="LOW">E ulët — estetike, pa rrezik</SelectItem>
                <SelectItem value="MEDIUM">Mesatare — pengon përditshmërinë</SelectItem>
                <SelectItem value="HIGH">E lartë — prek shumë banorë</SelectItem>
                <SelectItem value="CRITICAL">Kritike — rrezik për sigurinë</SelectItem>
              </SelectContent>
            </Select>
            <input type="hidden" name="priority" value={priority} />
            <p className="text-xs text-muted-foreground">
              Prioriteti përfundimtar caktohet nga komuna pas verifikimit.
            </p>
          </div>

          <div className="flex items-start gap-2.5">
            <Checkbox id="isAnonymous" name="isAnonymous" className="mt-0.5" />
            <Label htmlFor="isAnonymous" className="text-sm font-normal leading-relaxed">
              Publiko në mënyrë anonime
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Emri juaj nuk do të shfaqet publikisht, por komuna mund t&apos;ju kontaktojë për
                sqarime.
              </span>
            </Label>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Anulo
        </Button>
        <Button type="submit" size="lg" loading={pending} disabled={!location}>
          <Send /> Publiko raportin
        </Button>
      </div>
    </form>
  );
}
