import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import { TrelloClient } from "../trello-client.js";
import { textResult, handleToolError } from "../utils/response.js";
import type { TrelloCard, TrelloAction, TrelloAttachment, TrelloCustomFieldItem } from "../types.js";

export function register(server: McpServer, client: TrelloClient) {
  server.registerTool(
    "get_card",
    {
      title: "Get Card",
      description:
        "Get detailed information about a specific Trello card, including its checklists, labels, and members.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
      }),
    },
    async ({ cardId }) => {
      try {
        const card = await client.get<TrelloCard>(`/cards/${cardId}`, {
          fields: "id,name,desc,closed,url,idList,idBoard,due,dueComplete,labels,idMembers,pos,shortUrl",
          checklists: "all",
          checklist_fields: "id,name,pos",
          members: "true",
          member_fields: "fullName,username",
          attachments: "true",
          attachment_fields: "id,name,url,date,pos",
          customFieldItems: "true",
        });
        return textResult(card);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "create_card",
    {
      title: "Create Card",
      description: "Create a new card on a Trello list.",
      inputSchema: z.object({
        idList: z.string().describe("The ID of the list to create the card in"),
        name: z.string().describe("Name/title of the card"),
        desc: z.string().optional().describe("Description of the card"),
        pos: z
          .union([z.enum(["top", "bottom"]), z.number()])
          .optional()
          .describe("Position: 'top', 'bottom', or a positive number"),
        due: z
          .string()
          .optional()
          .describe("Due date (ISO 8601 format, e.g. 2024-12-31T12:00:00Z)"),
        idLabels: z
          .array(z.string())
          .optional()
          .describe("Array of label IDs to add"),
        idMembers: z
          .array(z.string())
          .optional()
          .describe("Array of member IDs to assign"),
      }),
    },
    async ({ idList, name, desc, pos, due, idLabels, idMembers }) => {
      try {
        const params: Record<string, string> = { idList, name };
        if (desc) params.desc = desc;
        if (pos !== undefined) params.pos = String(pos);
        if (due) params.due = due;
        if (idLabels?.length) params.idLabels = idLabels.join(",");
        if (idMembers?.length) params.idMembers = idMembers.join(",");
        const card = await client.post<TrelloCard>("/cards", params);
        return textResult(card);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "update_card",
    {
      title: "Update Card",
      description: "Update properties of an existing Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card to update"),
        name: z.string().optional().describe("New name for the card"),
        desc: z.string().optional().describe("New description"),
        due: z
          .string()
          .nullable()
          .optional()
          .describe("Due date (ISO 8601) or null to remove"),
        dueComplete: z
          .boolean()
          .optional()
          .describe("Whether the due date is complete"),
        pos: z
          .union([z.enum(["top", "bottom"]), z.number()])
          .optional()
          .describe("New position"),
      }),
    },
    async ({ cardId, name, desc, due, dueComplete, pos }) => {
      try {
        const params: Record<string, string> = {};
        if (name !== undefined) params.name = name;
        if (desc !== undefined) params.desc = desc;
        if (due !== undefined) params.due = due ?? "";
        if (dueComplete !== undefined)
          params.dueComplete = String(dueComplete);
        if (pos !== undefined) params.pos = String(pos);
        const card = await client.put<TrelloCard>(
          `/cards/${cardId}`,
          params,
        );
        return textResult(card);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "move_card",
    {
      title: "Move Card",
      description:
        "Move a card to a different list, and optionally to a different board.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card to move"),
        idList: z.string().describe("The ID of the destination list"),
        idBoard: z
          .string()
          .optional()
          .describe("The ID of the destination board (if moving across boards)"),
        pos: z
          .union([z.enum(["top", "bottom"]), z.number()])
          .optional()
          .describe("Position in the destination list"),
      }),
    },
    async ({ cardId, idList, idBoard, pos }) => {
      try {
        const params: Record<string, string> = { idList };
        if (idBoard) params.idBoard = idBoard;
        if (pos !== undefined) params.pos = String(pos);
        const card = await client.put<TrelloCard>(
          `/cards/${cardId}`,
          params,
        );
        return textResult(card);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "archive_card",
    {
      title: "Archive Card",
      description: "Archive (close) a Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card to archive"),
      }),
    },
    async ({ cardId }) => {
      try {
        const card = await client.put<TrelloCard>(`/cards/${cardId}`, {
          closed: "true",
        });
        return textResult(card);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "delete_card",
    {
      title: "Delete Card",
      description:
        "Permanently delete a Trello card. This cannot be undone — use archive_card for reversible removal.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card to permanently delete"),
      }),
    },
    async ({ cardId }) => {
      try {
        await client.delete(`/cards/${cardId}`);
        return textResult({ deleted: true, cardId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "add_comment",
    {
      title: "Add Comment",
      description: "Add a comment to a Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        text: z.string().describe("The comment text"),
      }),
    },
    async ({ cardId, text }) => {
      try {
        const action = await client.post<TrelloAction>(
          `/cards/${cardId}/actions/comments`,
          { text },
        );
        return textResult(action);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "update_comment",
    {
      title: "Update Comment",
      description: "Update the text of a comment on a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        actionId: z.string().describe("The ID of the comment action to update"),
        text: z.string().describe("The new comment text"),
      }),
    },
    async ({ cardId, actionId, text }) => {
      try {
        const action = await client.put<TrelloAction>(
          `/cards/${cardId}/actions/${actionId}/comments`,
          { text },
        );
        return textResult(action);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "delete_comment",
    {
      title: "Delete Comment",
      description: "Delete a comment from a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        actionId: z.string().describe("The ID of the comment action to delete"),
      }),
    },
    async ({ cardId, actionId }) => {
      try {
        await client.delete(
          `/cards/${cardId}/actions/${actionId}/comments`,
        );
        return textResult({ deleted: true, cardId, actionId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "add_label_to_card",
    {
      title: "Add Label to Card",
      description: "Add an existing label to a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        labelId: z.string().describe("The ID of the label to add"),
      }),
    },
    async ({ cardId, labelId }) => {
      try {
        await client.post(`/cards/${cardId}/idLabels`, { value: labelId });
        return textResult({ success: true, cardId, labelId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "remove_label_from_card",
    {
      title: "Remove Label from Card",
      description: "Remove a label from a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        labelId: z.string().describe("The ID of the label to remove"),
      }),
    },
    async ({ cardId, labelId }) => {
      try {
        await client.delete(`/cards/${cardId}/idLabels/${labelId}`);
        return textResult({ success: true, cardId, labelId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "add_member_to_card",
    {
      title: "Add Member to Card",
      description: "Assign a member to a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        memberId: z.string().describe("The ID of the member to assign"),
      }),
    },
    async ({ cardId, memberId }) => {
      try {
        await client.post(`/cards/${cardId}/idMembers`, { value: memberId });
        return textResult({ success: true, cardId, memberId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "remove_member_from_card",
    {
      title: "Remove Member from Card",
      description: "Unassign a member from a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        memberId: z.string().describe("The ID of the member to remove"),
      }),
    },
    async ({ cardId, memberId }) => {
      try {
        await client.delete(`/cards/${cardId}/idMembers/${memberId}`);
        return textResult({ success: true, cardId, memberId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "unarchive_card",
    {
      title: "Unarchive Card",
      description: "Unarchive (reopen) a closed Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card to unarchive"),
      }),
    },
    async ({ cardId }) => {
      try {
        const card = await client.put<TrelloCard>(`/cards/${cardId}`, {
          closed: "false",
        });
        return textResult(card);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "get_card_actions",
    {
      title: "Get Card Actions",
      description: "Get the activity feed (actions) for a card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        filter: z
          .string()
          .optional()
          .describe("Comma-separated action types to filter (e.g. commentCard,updateCard)"),
        limit: z
          .number()
          .optional()
          .describe("Max number of actions to return (default: 50, max: 1000)"),
      }),
    },
    async ({ cardId, filter, limit }) => {
      try {
        const params: Record<string, string> = {
          fields: "id,type,date,data,memberCreator",
          member_fields: "fullName,username",
        };
        if (filter) params.filter = filter;
        if (limit !== undefined) params.limit = String(limit);
        const actions = await client.get<TrelloAction[]>(
          `/cards/${cardId}/actions`,
          params,
        );
        return textResult(actions);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "list_attachments",
    {
      title: "List Attachments",
      description: "List all attachments on a Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
      }),
    },
    async ({ cardId }) => {
      try {
        const attachments = await client.get<TrelloAttachment[]>(
          `/cards/${cardId}/attachments`,
          { fields: "id,name,url,bytes,date,mimeType,isUpload,pos" },
        );
        return textResult(attachments);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "add_attachment",
    {
      title: "Add Attachment",
      description: "Add a URL attachment to a Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        url: z.string().describe("The URL to attach"),
        name: z.string().optional().describe("Display name for the attachment"),
      }),
    },
    async ({ cardId, url, name }) => {
      try {
        const params: Record<string, string> = { url };
        if (name) params.name = name;
        const attachment = await client.post<TrelloAttachment>(
          `/cards/${cardId}/attachments`,
          params,
        );
        return textResult(attachment);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "delete_attachment",
    {
      title: "Delete Attachment",
      description: "Delete an attachment from a Trello card.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        attachmentId: z.string().describe("The ID of the attachment to delete"),
      }),
    },
    async ({ cardId, attachmentId }) => {
      try {
        await client.delete(`/cards/${cardId}/attachments/${attachmentId}`);
        return textResult({ deleted: true, cardId, attachmentId });
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "get_card_custom_fields",
    {
      title: "Get Card Custom Fields",
      description:
        "Get custom field values for a Trello card. Requires Trello Premium or Enterprise.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
      }),
    },
    async ({ cardId }) => {
      try {
        const items = await client.get<TrelloCustomFieldItem[]>(
          `/cards/${cardId}/customFieldItems`,
        );
        return textResult(items);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );

  server.registerTool(
    "update_custom_field_item",
    {
      title: "Update Custom Field Item",
      description:
        "Set the value of a custom field on a card. Requires Trello Premium or Enterprise.",
      inputSchema: z.object({
        cardId: z.string().describe("The ID of the card"),
        customFieldId: z.string().describe("The ID of the custom field"),
        value: z
          .record(z.string(), z.string())
          .optional()
          .describe(
            "Value object — key depends on field type: { text: '...' }, { number: '...' }, { checked: 'true' }, { date: '2024-01-01T00:00:00.000Z' }. Omit or pass empty to clear.",
          ),
        idValue: z
          .string()
          .optional()
          .describe("For dropdown fields: the ID of the option to select. Pass empty string to clear."),
      }),
    },
    async ({ cardId, customFieldId, value, idValue }) => {
      try {
        const body: Record<string, unknown> = {};
        if (idValue !== undefined) {
          body.idValue = idValue || "";
        } else {
          body.value = value ?? {};
        }
        const result = await client.put(
          `/cards/${cardId}/customField/${customFieldId}/item`,
          undefined,
          body,
        );
        return textResult(result);
      } catch (err) {
        return handleToolError(err);
      }
    },
  );
}
