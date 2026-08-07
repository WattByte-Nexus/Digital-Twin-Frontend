import type { Meta, StoryObj } from "@storybook/react-vite";
import { Box, Cloud, FileClock, Map, Settings, User } from "lucide-react";

import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "./command";

function CommandPaletteContent() {
  return (
    <>
      <CommandInput placeholder="Search maps, layers, and tools..." />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Workspace">
          <CommandItem>
            <Map aria-hidden="true" />
            Open map
            <CommandShortcut>⌘M</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <Box aria-hidden="true" />
            Add data layer
            <CommandShortcut>⌘L</CommandShortcut>
          </CommandItem>
          <CommandItem>
            <FileClock aria-hidden="true" />
            Recent projects
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Account">
          <CommandItem>
            <User aria-hidden="true" />
            Profile
          </CommandItem>
          <CommandItem>
            <Cloud aria-hidden="true" />
            Cloud connections
          </CommandItem>
          <CommandItem>
            <Settings aria-hidden="true" />
            Settings
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </>
  );
}

const meta = {
  title: "UI/Command",
  component: Command,
  parameters: { layout: "centered" },
  tags: ["autodocs"],
} satisfies Meta<typeof Command>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command className="w-[min(28rem,calc(100vw-2rem))] border shadow-md">
      <CommandPaletteContent />
    </Command>
  ),
};

export const Empty: Story = {
  render: () => (
    <Command className="w-[min(28rem,calc(100vw-2rem))] border shadow-md">
      <CommandInput placeholder="Search commands..." value="no matching command" />
      <CommandList>
        <CommandEmpty>No commands found.</CommandEmpty>
        <CommandGroup heading="Workspace">
          <CommandItem>Open map</CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};

export const Dialog: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <CommandDialog defaultOpen theme="light">
      <CommandPaletteContent />
    </CommandDialog>
  ),
};

export const DarkDialog: Story = {
  parameters: { layout: "fullscreen" },
  render: () => (
    <CommandDialog defaultOpen theme="dark">
      <CommandPaletteContent />
    </CommandDialog>
  ),
};
