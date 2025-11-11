import { describe, expect, test } from 'bun:test';
import { cleanRdapUrl, cleanServerName } from '../src/crawler';

describe('cleanServerName', () => {
    test('should extract a valid hostname', () => {
        expect(cleanServerName('whois.nic.com')).toBe('whois.nic.com');
        expect(cleanServerName('rdap.example.org')).toBe('rdap.example.org');
    });

    test('should handle mixed case hostnames', () => {
        expect(cleanServerName('WHOIS.NIC.COM')).toBe('whois.nic.com');
        expect(cleanServerName('Whois.Example.Org')).toBe('whois.example.org');
    });

    test('should extract hostname from text with WHOIS Server prefix', () => {
        expect(cleanServerName('WHOIS Server: whois.nic.com')).toBe('whois.nic.com');
        expect(cleanServerName('WHOIS Server:whois.example.org')).toBe('whois.example.org');
    });

    test('should extract hostname from text with RDAP Server prefix', () => {
        expect(cleanServerName('RDAP Server: rdap.nic.com')).toBe('rdap.nic.com');
    });

    test('should extract hostname from text with URL prefix', () => {
        expect(cleanServerName('URL for registration services: https://example.com whois.nic.com')).toBe(
            'whois.nic.com'
        );
    });

    test('should handle hostnames with subdomains', () => {
        expect(cleanServerName('sub.domain.example.com')).toBe('sub.domain.example.com');
        expect(cleanServerName('whois.registry.nic.org')).toBe('whois.registry.nic.org');
    });

    test('should handle hostnames with hyphens', () => {
        expect(cleanServerName('whois-server.nic.com')).toBe('whois-server.nic.com');
        expect(cleanServerName('rdap.my-registry.org')).toBe('rdap.my-registry.org');
    });

    test('should return undefined for "None"', () => {
        expect(cleanServerName('None')).toBeUndefined();
    });

    test('should return undefined for "Not assigned"', () => {
        expect(cleanServerName('Not assigned')).toBeUndefined();
        expect(cleanServerName('Server Not assigned')).toBeUndefined();
    });

    test('should return undefined for empty string', () => {
        expect(cleanServerName('')).toBeUndefined();
    });

    test('should return undefined for invalid text without hostname', () => {
        expect(cleanServerName('No valid hostname here')).toBeUndefined();
        expect(cleanServerName('Just some text')).toBeUndefined();
    });

    test('should handle text with extra whitespace', () => {
        expect(cleanServerName('  whois.nic.com  ')).toBe('whois.nic.com');
        expect(cleanServerName('WHOIS Server:   whois.example.org   ')).toBe('whois.example.org');
    });
});

describe('cleanRdapUrl', () => {
    test('should return valid HTTPS URLs', () => {
        expect(cleanRdapUrl('https://rdap.example.com')).toBe('https://rdap.example.com');
        expect(cleanRdapUrl('https://rdap.nic.org/path')).toBe('https://rdap.nic.org/path');
    });

    test('should return valid HTTP URLs', () => {
        expect(cleanRdapUrl('http://rdap.example.com')).toBe('http://rdap.example.com');
    });

    test('should handle URLs with trailing slashes', () => {
        expect(cleanRdapUrl('https://rdap.example.com/')).toBe('https://rdap.example.com/');
        expect(cleanRdapUrl('https://rdap.nic.org/v1/')).toBe('https://rdap.nic.org/v1/');
    });

    test('should remove trailing punctuation', () => {
        expect(cleanRdapUrl('https://rdap.example.com.')).toBe('https://rdap.example.com');
        expect(cleanRdapUrl('https://rdap.example.com,')).toBe('https://rdap.example.com');
        expect(cleanRdapUrl('https://rdap.example.com  ')).toBe('https://rdap.example.com');
        expect(cleanRdapUrl('https://rdap.example.com. ')).toBe('https://rdap.example.com');
    });

    test('should handle URLs with query parameters', () => {
        expect(cleanRdapUrl('https://rdap.example.com?query=test')).toBe('https://rdap.example.com?query=test');
    });

    test('should handle URLs with fragments', () => {
        expect(cleanRdapUrl('https://rdap.example.com#section')).toBe('https://rdap.example.com#section');
    });

    test('should return undefined for empty string', () => {
        expect(cleanRdapUrl('')).toBeUndefined();
    });

    test('should return undefined for invalid URLs without protocol', () => {
        expect(cleanRdapUrl('rdap.example.com')).toBeUndefined();
        expect(cleanRdapUrl('www.example.com')).toBeUndefined();
    });

    test('should return undefined for invalid protocols', () => {
        expect(cleanRdapUrl('ftp://rdap.example.com')).toBeUndefined();
        expect(cleanRdapUrl('file:///path/to/file')).toBeUndefined();
    });

    test('should handle complex RDAP URLs', () => {
        expect(cleanRdapUrl('https://rdap.nic.xn--mgba3a3ejt/')).toBe('https://rdap.nic.xn--mgba3a3ejt/');
        expect(cleanRdapUrl('https://tld-rdap.verisign.com/com/v1/')).toBe('https://tld-rdap.verisign.com/com/v1/');
    });
});
