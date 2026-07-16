import React from "react";

// Shared bordered panel used by tables, forms, and dashboard sections.
export function Panel({ title, children, tools }) {
  return (
    <section className="panel">
      <header>
        <h2>{title}</h2>
        <div>{tools}</div>
      </header>
      {children}
    </section>
  );
}
