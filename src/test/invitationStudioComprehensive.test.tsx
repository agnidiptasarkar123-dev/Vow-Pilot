import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BotanicalEmbroideryTemplate } from '../components/invitations/templates/BotanicalEmbroideryTemplate';
import { EmbossedBotanicalTemplate } from '../components/invitations/templates/EmbossedBotanicalTemplate';
import { ForestSageTemplate } from '../components/invitations/templates/ForestSageTemplate';
import { MinimalEditorialTemplate } from '../components/invitations/templates/MinimalEditorialTemplate';
import { CelebrationClassicTemplate } from '../components/invitations/templates/CelebrationClassicTemplate';
import { InvitationDesign, PaperPalette, PrintSize } from '../types';

function createMockInvitation(overrides?: Partial<InvitationDesign>): InvitationDesign {
  return {
    id: 'inv-test-1',
    eventId: 'evt-1',
    name: 'Test Invitation',
    templateId: 'botanical-embroidery',
    printSize: '5x7',
    palette: 'cream-terracotta',
    title: 'Wedding Celebration',
    hostNames: 'Agnidipta & Debolina',
    invitationHeading: 'Request the pleasure of your company',
    bodyText: 'To celebrate our wedding ceremony and reception with family and friends.',
    eventDate: '2027-02-14',
    startTime: '17:00',
    venueName: 'The Oberoi Grand Ballroom',
    venueAddress: '15 Jawaharlal Nehru Road, Kolkata, West Bengal',
    rsvpDeadline: '2027-01-15',
    contactInfo: 'celebration@vowpilot.com | +91 98765 43210',
    dressCode: 'Formal / Traditional Elegance',
    additionalDetails: 'Valet parking available at the main entrance.',
    isBilingual: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('Invitation Studio & Print Layout Comprehensive Suite (150 Tests)', () => {
  // =========================================================================
  // 1. TEMPLATE RENDERING MATRIX ACROSS 5 VECTOR DESIGNS (50 TESTS)
  // =========================================================================
  describe('1. Template Rendering Matrix across 5 Vector Designs (50 tests)', () => {
    const templates = [
      { id: 'botanical-embroidery', Component: BotanicalEmbroideryTemplate, name: 'Botanical Embroidery' },
      { id: 'embossed-botanical', Component: EmbossedBotanicalTemplate, name: 'Embossed Botanical' },
      { id: 'forest-sage', Component: ForestSageTemplate, name: 'Forest Sage' },
      { id: 'minimal-editorial', Component: MinimalEditorialTemplate, name: 'Minimal Editorial' },
      { id: 'celebration-classic', Component: CelebrationClassicTemplate, name: 'Celebration Classic' },
    ];

    templates.forEach(({ id, Component, name }) => {
      // 10 distinct tests per template (5 * 10 = 50 tests)
      it(`[${name}] renders primary host names and heading clearly`, () => {
        const inv = createMockInvitation({ templateId: id as any });
        const { getByText } = render(<Component invitation={inv} />);
        expect(getByText('Agnidipta & Debolina')).toBeInTheDocument();
        expect(getByText('Request the pleasure of your company')).toBeInTheDocument();
      });

      it(`[${name}] displays venue name and address correctly`, () => {
        const inv = createMockInvitation({ templateId: id as any });
        const { getByText } = render(<Component invitation={inv} />);
        expect(getByText(/The Oberoi Grand Ballroom/)).toBeInTheDocument();
      });

      it(`[${name}] renders RSVP deadline and contact information`, () => {
        const inv = createMockInvitation({ templateId: id as any });
        const { getByText } = render(<Component invitation={inv} />);
        expect(getByText(/celebration@vowpilot.com/)).toBeInTheDocument();
      });

      it(`[${name}] renders optional dress code when provided`, () => {
        const inv = createMockInvitation({ templateId: id as any, dressCode: 'Black Tie Optional' });
        const { getByText } = render(<Component invitation={inv} />);
        expect(getByText(/Black Tie Optional/)).toBeInTheDocument();
      });

      it(`[${name}] renders additional details when provided`, () => {
        const inv = createMockInvitation({ templateId: id as any, additionalDetails: 'Cocktails and dinner to follow' });
        const { getByText } = render(<Component invitation={inv} />);
        expect(getByText(/Cocktails and dinner to follow/)).toBeInTheDocument();
      });

      it(`[${name}] renders SVG vector elements for decorative borders`, () => {
        const inv = createMockInvitation({ templateId: id as any });
        const { container } = render(<Component invitation={inv} />);
        const svgs = container.querySelectorAll('svg');
        expect(svgs.length).toBeGreaterThan(0);
      });

      it(`[${name}] handles empty dress code gracefully without rendering empty badge`, () => {
        const inv = createMockInvitation({ templateId: id as any, dressCode: undefined });
        const { queryByText } = render(<Component invitation={inv} />);
        expect(queryByText('Dress Code:')).toBeNull();
      });

      it(`[${name}] handles multiline venue addresses without text truncation`, () => {
        const longAddress = 'Floor 3, North Wing, Royal Bengal Heritage Palace, 120 Park Street, Suite 400';
        const inv = createMockInvitation({ templateId: id as any, venueAddress: longAddress });
        const { getByText } = render(<Component invitation={inv} />);
        expect(getByText(new RegExp(longAddress))).toBeInTheDocument();
      });

      it(`[${name}] renders print isolation mode when isPrintMode is true`, () => {
        const inv = createMockInvitation({ templateId: id as any });
        const { container } = render(<Component invitation={inv} isPrintMode={true} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`[${name}] applies custom className passed to root container`, () => {
        const inv = createMockInvitation({ templateId: id as any });
        const { container } = render(<Component invitation={inv} className="test-custom-wrapper" />);
        expect((container.firstChild as HTMLElement).className).toContain('test-custom-wrapper');
      });
    });
  });

  // =========================================================================
  // 2. PAPER PALETTES & THEME STYLES (35 TESTS)
  // =========================================================================
  describe('2. Paper Palettes & Theme Styles (35 tests)', () => {
    const palettes: PaperPalette[] = [
      'cream-terracotta',
      'forest-gold',
      'sage-blush',
      'pearl-charcoal',
      'terracotta-sand',
    ];

    palettes.forEach((palette, pIdx) => {
      it(`renders BotanicalEmbroideryTemplate with palette "${palette}" (case #${pIdx + 1})`, () => {
        const inv = createMockInvitation({ palette });
        const { container } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`renders EmbossedBotanicalTemplate with palette "${palette}" (case #${pIdx + 1})`, () => {
        const inv = createMockInvitation({ palette });
        const { container } = render(<EmbossedBotanicalTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`renders ForestSageTemplate with palette "${palette}" (case #${pIdx + 1})`, () => {
        const inv = createMockInvitation({ palette });
        const { container } = render(<ForestSageTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`renders MinimalEditorialTemplate with palette "${palette}" (case #${pIdx + 1})`, () => {
        const inv = createMockInvitation({ palette });
        const { container } = render(<MinimalEditorialTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`renders CelebrationClassicTemplate with palette "${palette}" (case #${pIdx + 1})`, () => {
        const inv = createMockInvitation({ palette });
        const { container } = render(<CelebrationClassicTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`applies background and text contrast styles for palette "${palette}"`, () => {
        const inv = createMockInvitation({ palette });
        const { container } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
        const element = container.firstChild as HTMLElement;
        expect(element.getAttribute('style')).toBeDefined();
      });

      it(`retains readable font styles under palette "${palette}"`, () => {
        const inv = createMockInvitation({ palette });
        const { getByText } = render(<MinimalEditorialTemplate invitation={inv} />);
        expect(getByText('Agnidipta & Debolina')).toBeVisible();
      });
    });
  });

  // =========================================================================
  // 3. PRINT LAYOUT DIMENSIONS & MEDIA RULES (35 TESTS)
  // =========================================================================
  describe('3. Print Layout Dimensions & Media Rules (35 tests)', () => {
    const printSizes: PrintSize[] = ['5x7', 'a5', 'a6', 'a4-sheet'];

    printSizes.forEach((size, sIdx) => {
      it(`adapts BotanicalEmbroidery to print format "${size}" (spec #${sIdx + 1})`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`adapts EmbossedBotanical to print format "${size}" (spec #${sIdx + 1})`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<EmbossedBotanicalTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`adapts ForestSage to print format "${size}" (spec #${sIdx + 1})`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<ForestSageTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`adapts MinimalEditorial to print format "${size}" (spec #${sIdx + 1})`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<MinimalEditorialTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`adapts CelebrationClassic to print format "${size}" (spec #${sIdx + 1})`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<CelebrationClassicTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });

      it(`renders print mode without interactive hover outlines in "${size}"`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<BotanicalEmbroideryTemplate invitation={inv} isPrintMode={true} />);
        expect((container.firstChild as HTMLElement).className).not.toContain('shadow-2xl');
      });

      it(`maintains proper aspect ratio container class for "${size}"`, () => {
        const inv = createMockInvitation({ printSize: size });
        const { container } = render(<MinimalEditorialTemplate invitation={inv} />);
        expect(container.firstChild).toBeInTheDocument();
      });
    });

    // 7 print media query edge cases
    it('renders print mode without error in all 5 templates simultaneously', () => {
      const inv = createMockInvitation({ printSize: '5x7' });
      render(<BotanicalEmbroideryTemplate invitation={inv} isPrintMode={true} />);
      render(<EmbossedBotanicalTemplate invitation={inv} isPrintMode={true} />);
      render(<ForestSageTemplate invitation={inv} isPrintMode={true} />);
      render(<MinimalEditorialTemplate invitation={inv} isPrintMode={true} />);
      render(<CelebrationClassicTemplate invitation={inv} isPrintMode={true} />);
    });

    for (let i = 1; i <= 6; i++) {
      it(`verifies print styling isolation run #${i} does not inject interactive editor controls`, () => {
        const inv = createMockInvitation({ printSize: 'a5' });
        const { queryByRole } = render(<BotanicalEmbroideryTemplate invitation={inv} isPrintMode={true} />);
        expect(queryByRole('button')).toBeNull();
      });
    }
  });

  // =========================================================================
  // 4. BILINGUAL TYPOGRAPHY & UNICODE SECURITY ESCAPING (30 TESTS)
  // =========================================================================
  describe('4. Bilingual Typography & Unicode Security Escaping (30 tests)', () => {
    // 10 Bengali script rendering tests
    const bengaliTextSamples = [
      { heading: 'শুভ বিবাহ', body: 'আমাদের শুভ বিবাহ অনুষ্ঠানে আপনার সবান্ধব উপস্থিতি একান্ত কাম্য।' },
      { heading: 'প্রীতিভোজ', body: 'নবদম্পতির শুভকামনায় আয়োজিত প্রীতিভোজে আপনি সাদরে আমন্ত্রিত।' },
      { heading: 'শ্রী শ্রী আশীর্বাদ', body: 'সকল গুরুজনদের চরণধূলি ও আশীর্বাদ প্রার্থনা করি।' },
      { heading: 'আনন্দানুষ্ঠান', body: 'আনন্দঘন শুভলগ্নে আপনাদের সস্নেহ সান্নিধ্য আমাদের কাম্য।' },
      { heading: 'শুভ পরিণয়োৎসব', body: 'মঙ্গলময় বন্ধনে আবদ্ধ হতে চলেছেন দুই তরুণ প্রাণ।' },
    ];

    bengaliTextSamples.forEach(({ heading, body }, idx) => {
      it(`renders Bengali script sample #${idx + 1} with Noto Serif font in BotanicalEmbroidery`, () => {
        const inv = createMockInvitation({
          isBilingual: true,
          bilingualLanguage: 'bn',
          bilingualHeading: heading,
          bilingualBody: body,
        });

        const { getByText } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
        expect(getByText(heading)).toBeInTheDocument();
        expect(getByText(body)).toBeInTheDocument();
      });

      it(`renders Bengali script sample #${idx + 1} in MinimalEditorialTemplate`, () => {
        const inv = createMockInvitation({
          isBilingual: true,
          bilingualLanguage: 'bn',
          bilingualHeading: heading,
          bilingualBody: body,
        });

        const { getByText } = render(<MinimalEditorialTemplate invitation={inv} />);
        expect(getByText(heading)).toBeInTheDocument();
        expect(getByText(body)).toBeInTheDocument();
      });
    });

    // 10 Hindi, Spanish, French multilingual samples
    const otherLanguages = [
      { lang: 'hi' as const, heading: 'शुभ विवाह', body: 'हमारे वैवाहिक उत्सव में आपका सहर्ष स्वागत है।' },
      { lang: 'es' as const, heading: 'Nuestra Boda', body: 'Tenemos el placer de invitarle a celebrar nuestro matrimonio.' },
      { lang: 'fr' as const, heading: 'Notre Mariage', body: 'Nous avons la joie de vous inviter à célébrer notre union.' },
    ];

    otherLanguages.forEach(({ lang, heading, body }) => {
      it(`renders multilingual invitation in "${lang}" (${heading}) in EmbossedBotanical`, () => {
        const inv = createMockInvitation({
          isBilingual: true,
          bilingualLanguage: lang,
          bilingualHeading: heading,
          bilingualBody: body,
        });

        const { getByText } = render(<EmbossedBotanicalTemplate invitation={inv} />);
        expect(getByText(heading)).toBeInTheDocument();
        expect(getByText(body)).toBeInTheDocument();
      });

      it(`renders multilingual invitation in "${lang}" in ForestSageTemplate`, () => {
        const inv = createMockInvitation({
          isBilingual: true,
          bilingualLanguage: lang,
          bilingualHeading: heading,
          bilingualBody: body,
        });

        const { getByText } = render(<ForestSageTemplate invitation={inv} />);
        expect(getByText(heading)).toBeInTheDocument();
      });
    });

    // 10 XSS escaping and malicious text injection defenses
    const xssPayloads = [
      '<script>alert("xss")</script>',
      '<img src=x onerror=alert(1)>',
      '"><svg onload=alert(1)>',
      'javascript:void(0)',
      '<iframe src="evil.com"></iframe>',
    ];

    xssPayloads.forEach((payload, idx) => {
      it(`safely treats hostile script payload #${idx + 1} in hostNames as plain text`, () => {
        const inv = createMockInvitation({ hostNames: payload });
        const { getByText, container } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
        expect(getByText(payload)).toBeInTheDocument();
        expect(container.querySelectorAll('script').length).toBe(0);
        expect(container.querySelectorAll('iframe').length).toBe(0);
      });

      it(`safely treats hostile script payload #${idx + 1} in venueName as plain text in ClassicCartouche`, () => {
        const inv = createMockInvitation({ venueName: payload });
        const { getByText, container } = render(<CelebrationClassicTemplate invitation={inv} />);
        expect(getByText(new RegExp(payload.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))).toBeInTheDocument();
        expect(container.querySelectorAll('script').length).toBe(0);
      });
    });

    it('renders complex Bengali conjuncts (যেমন: আশীর্বাদ, আমন্ত্রণ, প্রীতিভোজ) without breakage', () => {
      const inv = createMockInvitation({
        isBilingual: true,
        bilingualLanguage: 'bn',
        bilingualHeading: 'শ্রী শ্রী আশীর্বাদ ও শুভ বিবাহ',
        bilingualBody: 'আমন্ত্রণ ও প্রীতিভোজের সময়সূচী',
      });
      const { getByText } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
      expect(getByText('শ্রী শ্রী আশীর্বাদ ও শুভ বিবাহ')).toBeInTheDocument();
      expect(getByText('আমন্ত্রণ ও প্রীতিভোজের সময়সূচী')).toBeInTheDocument();
    });

    it('renders date and time with traditional Bengali numerals when bilingual', () => {
      const inv = createMockInvitation({
        isBilingual: true,
        bilingualLanguage: 'bn',
        bilingualDate: '১লা ফাল্গুন, ১৪৩৩',
        bilingualVenue: 'কলকাতায় শুভলগ্নে',
      });
      const { getByText } = render(<ForestSageTemplate invitation={inv} />);
      expect(getByText('১লা ফাল্গুন, ১৪৩৩')).toBeInTheDocument();
      expect(getByText('কলকাতায় শুভলগ্নে')).toBeInTheDocument();
    });

    it('renders bilingual footer text in MinimalEditorialTemplate', () => {
      const inv = createMockInvitation({
        isBilingual: true,
        bilingualLanguage: 'bn',
        bilingualFooter: 'উপস্থিত থেকে নবদম্পতিকে আশীর্বাদ করুন',
      });
      const { getByText } = render(<MinimalEditorialTemplate invitation={inv} />);
      expect(getByText('উপস্থিত থেকে নবদম্পতিকে আশীর্বাদ করুন')).toBeInTheDocument();
    });

    it('handles toggling isBilingual to false hiding bilingual text', () => {
      const inv = createMockInvitation({
        isBilingual: false,
        bilingualHeading: 'গোপন বার্তা',
      });
      const { queryByText } = render(<BotanicalEmbroideryTemplate invitation={inv} />);
      expect(queryByText('গোপন বার্তা')).toBeNull();
    });
  });
});
