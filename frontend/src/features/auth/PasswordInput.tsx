"use client";

import { useState } from "react";
import { Input, type InputProps } from "@/components/ui";

/** Room on the right of the text for the SHOW / HIDE toggle. */
const TOGGLE_ROOM = { paddingRight: 76 };

/** A password field with a SHOW / HIDE toggle inside its right edge, as Duolingo places FORGOT?. */
export function PasswordInput({ className, ...rest }: Omit<InputProps, "type">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className={className}>
      <div className="relative">
        <Input type={visible ? "text" : "password"} style={TOGGLE_ROOM} {...rest} />
        <button
          type="button"
          aria-label={visible ? "Hide password" : "Show password"}
          aria-pressed={visible}
          aria-controls={rest.id}
          onClick={() => setVisible((shown) => !shown)}
          className="absolute top-0 right-0 flex h-[50px] cursor-pointer items-center rounded-md px-4 text-label text-fg-3 uppercase hover:text-fg-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </div>
  );
}
