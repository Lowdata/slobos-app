"use client";

import React from 'react';

export default function Modal({ isOpen, onClose, children }) {
  if (!isOpen) return null;

  return (
    <div className="modal-root">
      <div className="modal-backdrop" onClick={onClose} data-close></div>
      <div className="modal">
        {children}
      </div>
    </div>
  );
}
