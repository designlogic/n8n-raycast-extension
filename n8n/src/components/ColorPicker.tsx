import { Form, Icon, Color } from "@raycast/api";

interface ColorPickerProps {
  defaultColor?: string;
  onChange: (color: string) => void;
}

const COLORS = [
  { name: "Red", value: "#FF6B6B" },
  { name: "Pink", value: "#FF69B4" },
  { name: "Orange", value: "#FFA500" },
  { name: "Yellow", value: "#FFBE0B" },
  { name: "Green", value: "#4ECB71" },
  { name: "Teal", value: "#4ECDC4" },
  { name: "Blue", value: "#45B7D1" },
  { name: "Purple", value: "#8338EC" },
  { name: "Royal Blue", value: "#3A86FF" },
  { name: "Gray", value: "#808080" }
];

export function ColorPicker({ defaultColor = "#FF6B6B", onChange }: ColorPickerProps) {
  return (
    <Form.Dropdown
      id="color"
      title="Instance Color"
      defaultValue={defaultColor}
      onChange={onChange}
    >
      {COLORS.map(color => (
        <Form.Dropdown.Item
          key={color.value}
          value={color.value}
          title={color.name}
          icon={{ source: Icon.Circle, tintColor: color.value as Color }}
        />
      ))}
    </Form.Dropdown>
  );
}
