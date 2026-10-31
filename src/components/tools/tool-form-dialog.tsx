"use client";

import { useMutation } from "convex/react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Field, Input, Select, Textarea } from "@/components/ui/field";
import { InlineAlert } from "@/components/ui/inline-alert";
import { Modal } from "@/components/ui/modal";
import { CATEGORY_LABELS, CONDITION_LABELS } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { api } from "@convex/_generated/api";
import {
  MAX_TOOL_DESCRIPTION_LENGTH,
  MAX_TOOL_NAME_LENGTH,
  MIN_TOOL_DESCRIPTION_LENGTH,
  TOOL_CATEGORIES,
  TOOL_CONDITIONS,
  type ToolCategory,
  type ToolCondition,
} from "@convex/lib/constants";
import type { Id } from "@convex/_generated/dataModel";

export type EditableTool = {
  _id: Id<"tools">;
  name: string;
  category: ToolCategory;
  condition: ToolCondition;
  description: string;
};

export function ToolFormDialog({
  open,
  onClose,
  onSaved,
  tool,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  tool?: EditableTool;
}) {
  const createTool = useMutation(api.tools.create);
  const updateTool = useMutation(api.tools.update);
  const editing = Boolean(tool);

  const [name, setName] = useState(tool?.name ?? "");
  const [category, setCategory] = useState<ToolCategory>(tool?.category ?? "power-tools");
  const [condition, setCondition] = useState<ToolCondition>(tool?.condition ?? "good");
  const [description, setDescription] = useState(tool?.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const trimmedDescription = description.trim();

    if (trimmedName.length < 2 || trimmedName.length > MAX_TOOL_NAME_LENGTH) {
      setError(`Give the tool a name between 2 and ${MAX_TOOL_NAME_LENGTH} characters.`);
      return;
    }
    if (
      trimmedDescription.length < MIN_TOOL_DESCRIPTION_LENGTH ||
      trimmedDescription.length > MAX_TOOL_DESCRIPTION_LENGTH
    ) {
      setError(
        `Add a description between ${MIN_TOOL_DESCRIPTION_LENGTH} and ${MAX_TOOL_DESCRIPTION_LENGTH} characters.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      if (tool) {
        await updateTool({
          toolId: tool._id,
          name: trimmedName,
          category,
          condition,
          description: trimmedDescription,
        });
      } else {
        await createTool({
          name: trimmedName,
          category,
          condition,
          description: trimmedDescription,
        });
      }
      onSaved();
    } catch (cause) {
      setError(getErrorMessage(cause));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit listing" : "List a tool"}
      description={
        editing
          ? "Update the details neighbors see on the board."
          : "A clear name and a short description go a long way."
      }
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <InlineAlert tone="error">{error}</InlineAlert> : null}

        <Field label="Tool name" htmlFor="tool-name" hint={`${name.length}/${MAX_TOOL_NAME_LENGTH}`}>
          <Input
            id="tool-name"
            value={name}
            maxLength={MAX_TOOL_NAME_LENGTH}
            required
            autoComplete="off"
            placeholder="Cordless drill"
            onChange={(event) => setName(event.target.value)}
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Category" htmlFor="tool-category">
            <Select
              id="tool-category"
              value={category}
              onChange={(event) => setCategory(event.target.value as ToolCategory)}
            >
              {TOOL_CATEGORIES.map((value) => (
                <option key={value} value={value}>
                  {CATEGORY_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Condition" htmlFor="tool-condition">
            <Select
              id="tool-condition"
              value={condition}
              onChange={(event) => setCondition(event.target.value as ToolCondition)}
            >
              {TOOL_CONDITIONS.map((value) => (
                <option key={value} value={value}>
                  {CONDITION_LABELS[value]}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field
          label="Short description"
          htmlFor="tool-description"
          hint={`${description.length}/${MAX_TOOL_DESCRIPTION_LENGTH} · Include what is in the box and any care notes.`}
        >
          <Textarea
            id="tool-description"
            value={description}
            maxLength={MAX_TOOL_DESCRIPTION_LENGTH}
            required
            placeholder="18V drill with two batteries and a bit set. Great for shelves and flat-pack furniture."
            onChange={(event) => setDescription(event.target.value)}
          />
        </Field>

        <div className="flex flex-col-reverse gap-2 border-t border-line pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" loading={submitting}>
            {editing ? "Save changes" : "Add to the board"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
