import React from 'react';
import { LINKS } from '../constants';
import styles from './Footer.module.css';

export default function Footer() {
  return (
    <footer className={styles.footer}>
      <a
        className={styles.botLink}
        href={LINKS.BOT}
        target="_blank"
        rel="noopener noreferrer"
      >
        Press to get instant notifications about reward distribution (via telegram)
      </a>
      <a
        className={styles.srcLink}
        href={LINKS.GITHUB}
        target="_blank"
        rel="noopener noreferrer"
      >
        View source on GitHub
      </a>
    </footer>
  );
}
