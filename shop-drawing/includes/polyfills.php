<?php
/**
 * Tương thích PHP 7.4+ (một số hosting chưa có PHP 8).
 */
if (!function_exists('str_contains')) {
  function str_contains($haystack, $needle) {
    return $needle === '' || strpos((string) $haystack, (string) $needle) !== false;
  }
}
if (!function_exists('str_starts_with')) {
  function str_starts_with($haystack, $needle) {
    $haystack = (string) $haystack;
    $needle = (string) $needle;
    return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
  }
}
if (!function_exists('str_ends_with')) {
  function str_ends_with($haystack, $needle) {
    $haystack = (string) $haystack;
    $needle = (string) $needle;
    if ($needle === '') return true;
    return substr($haystack, -strlen($needle)) === $needle;
  }
}
