import React from 'react';
import { css } from 'glamor';
import { createElement } from 'glamor/react';
/* @jsx createElement */

let spin = css.keyframes({
  from: { transform: 'rotate(0deg)' },
  to: { transform: 'rotate(-360deg)' },
});
export const Spinner = size => (
  <div
    css={{
      height: 50,
      fontSize: 50,
      width: 50,
      margin: '2rem auto',
      transformOrigin: '50% 75%',
      textAlign: 'center',
      animation: `${spin} infinite 1s linear`,
    }}
  >
    🌀
  </div>
);
