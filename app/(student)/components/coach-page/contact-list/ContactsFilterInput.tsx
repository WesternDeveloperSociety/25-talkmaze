import type { ChangeEvent, FC } from "react";

export type ContactsFilterInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  onFocus?: () => void;
  onBlur?: () => void;
};

const ContactsFilterInput: FC<ContactsFilterInputProps> = ({
  value,
  onChange,
  placeholder = "Search contacts",
  onFocus,
  onBlur,
}) => {
  // Update the value for the controlled input
  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
  };

  return (
    <input
      type="text"
      value={value}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={placeholder}
      className="w-full h-10 p-4 mb-3 rounded-[9px] border border-gray-500
       placeholder:text-gray-400 text-white"
    />
  );
};

export default ContactsFilterInput;
