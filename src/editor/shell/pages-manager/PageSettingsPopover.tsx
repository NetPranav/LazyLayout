"use client";

import React, { useState } from "react";
import { Popover } from "@/editor/components/Popover";
import { TextField } from "@/editor/components/TextField";
import { Button } from "@/editor/components/Button";
import { normaliseRoute, updatePageSettings, type PageItem } from "./pagesModel";

const FIELD_LABEL = "ll:font-mono ll:text-micro ll:tracking-normal ll:text-muted ll:shrink-0";
const FIELD_BOX =
  "ll:flex ll:flex-col ll:gap-1 ll:px-2 ll:py-1.5 ll:bg-surface-bar ll:border ll:border-transparent ll:hover:border-muted ll:focus-within:border-primary ll:rounded-sm";

export interface PageSettingsPopoverProps {
  page: PageItem | null;
  anchorEl: HTMLElement | null;
  onClose: () => void;
}

/** Title, route, search description and share image of one page, in the same fields the right panel's Page section uses. */
export const PageSettingsPopover: React.FC<PageSettingsPopoverProps> = ({ page, anchorEl, onClose }) => (
  <Popover open={page !== null} onClose={onClose} anchorEl={anchorEl} side="right" width={288} family="inspector-options" aria-label="Page settings">
    {page && <SettingsForm key={page.id} page={page} onDone={onClose} />}
  </Popover>
);

const SettingsForm: React.FC<{ page: PageItem; onDone: () => void }> = ({ page, onDone }) => {
  const [title, setTitle] = useState(page.title);
  const [route, setRoute] = useState(page.route);
  const [description, setDescription] = useState(page.description);
  const [error, setError] = useState<string | null>(null);

  const commit = (): boolean => {
    const err = updatePageSettings(page.id, { title, route, description });
    setError(err);
    if (err === null) setRoute(normaliseRoute(route));
    return err === null;
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      if (commit()) onDone();
    }
  };

  return (
    <div className="ll:flex ll:flex-col ll:gap-2 ll:font-sans" data-testid="page-settings" onKeyDown={onKey}>
      <div className="ll:text-small ll:font-medium ll:text-primary ll:truncate">{page.name} settings</div>
      <TextField
        size="sm"
        prefixLabel="Title"
        aria-label="Page title"
        value={title}
        placeholder={page.name}
        onChange={(e) => setTitle(e.target.value)}
        onBlur={commit}
      />
      <TextField
        size="sm"
        mono
        prefixLabel="Route"
        aria-label="Page route"
        value={route}
        disabled={page.isHome}
        error={error ?? undefined}
        onChange={(e) => setRoute(e.target.value)}
        onBlur={commit}
      />
      <label className={FIELD_BOX}>
        <span className={FIELD_LABEL}>Description</span>
        <textarea
          aria-label="Search description"
          rows={3}
          value={description}
          placeholder="Shown under the title in search results"
          onChange={(e) => setDescription(e.target.value)}
          onBlur={commit}
          className="ll:w-full ll:resize-none ll:bg-transparent ll:border-0 ll:p-0 ll:m-0 ll:outline-none ll:font-sans ll:text-small ll:text-primary ll:placeholder:text-muted"
        />
      </label>
      <div className={`${FIELD_BOX} ll:opacity-60`} aria-disabled="true">
        <span className={FIELD_LABEL}>Share image</span>
        <span className="ll:text-small ll:text-muted">Not supported by the engine yet</span>
      </div>
      <div className="ll:flex ll:justify-end">
        <Button
          size="sm"
          variant="strong"
          onClick={() => {
            if (commit()) onDone();
          }}
        >
          Done
        </Button>
      </div>
    </div>
  );
};
