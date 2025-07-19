import { describe, it, expect, beforeEach, vi } from 'vitest'
import jsPDF from 'jspdf'
import { 
  PDFFontManager, 
  createFontManager, 
  applyConsistentFont,
  type FontState 
} from '../fontManager'

// Mock jsPDF
vi.mock('jspdf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      setFontSize: vi.fn(),
      setFont: vi.fn()
    }))
  }
})

describe('PDFFontManager', () => {
  let fontManager: PDFFontManager
  let mockPdf: any

  beforeEach(() => {
    fontManager = new PDFFontManager()
    mockPdf = {
      setFontSize: vi.fn(),
      setFont: vi.fn()
    }
  })

  describe('constructor', () => {
    it('should initialize with default font state', () => {
      const state = fontManager.getCurrentFontState()
      
      expect(state).toEqual({
        family: 'times',
        size: 11,
        style: 'normal'
      })
    })
  })

  describe('setConsistentFont', () => {
    it('should set normal font correctly', () => {
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(12)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'normal')
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 12,
        style: 'normal'
      })
    })

    it('should set bold font correctly', () => {
      fontManager.setConsistentFont(mockPdf, 14, true, false)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(14)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bold')
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 14,
        style: 'bold'
      })
    })

    it('should set italic font correctly', () => {
      fontManager.setConsistentFont(mockPdf, 10, false, true)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(10)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'italic')
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 10,
        style: 'italic'
      })
    })

    it('should set bold italic font correctly', () => {
      fontManager.setConsistentFont(mockPdf, 16, true, true)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(16)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bolditalic')
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 16,
        style: 'bolditalic'
      })
    })

    it('should not call PDF methods if state has not changed', () => {
      // Set initial state
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      
      // Clear mock calls
      mockPdf.setFontSize.mockClear()
      mockPdf.setFont.mockClear()
      
      // Set same state again
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      
      // Should not have called PDF methods
      expect(mockPdf.setFontSize).not.toHaveBeenCalled()
      expect(mockPdf.setFont).not.toHaveBeenCalled()
    })

    it('should call PDF methods when font size changes', () => {
      // Set initial state
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      mockPdf.setFontSize.mockClear()
      mockPdf.setFont.mockClear()
      
      // Change font size
      fontManager.setConsistentFont(mockPdf, 14, false, false)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(14)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'normal')
    })

    it('should call PDF methods when font style changes', () => {
      // Set initial state
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      mockPdf.setFontSize.mockClear()
      mockPdf.setFont.mockClear()
      
      // Change to bold
      fontManager.setConsistentFont(mockPdf, 12, true, false)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(12)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bold')
    })
  })

  describe('resetToDefault', () => {
    it('should reset font to default settings', () => {
      // Set non-default state
      fontManager.setConsistentFont(mockPdf, 20, true, true)
      mockPdf.setFontSize.mockClear()
      mockPdf.setFont.mockClear()
      
      // Reset to default
      fontManager.resetToDefault(mockPdf)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(11)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'normal')
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 11,
        style: 'normal'
      })
    })
  })

  describe('getCurrentFontState', () => {
    it('should return a copy of the current state', () => {
      const state1 = fontManager.getCurrentFontState()
      const state2 = fontManager.getCurrentFontState()
      
      // Should be equal but not the same object
      expect(state1).toEqual(state2)
      expect(state1).not.toBe(state2)
    })

    it('should reflect changes after font updates', () => {
      fontManager.setConsistentFont(mockPdf, 18, true, false)
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 18,
        style: 'bold'
      })
    })
  })

  describe('isCurrentState', () => {
    it('should return true for matching state', () => {
      fontManager.setConsistentFont(mockPdf, 12, true, false)
      
      expect(fontManager.isCurrentState(12, true, false)).toBe(true)
    })

    it('should return false for different font size', () => {
      fontManager.setConsistentFont(mockPdf, 12, true, false)
      
      expect(fontManager.isCurrentState(14, true, false)).toBe(false)
    })

    it('should return false for different bold state', () => {
      fontManager.setConsistentFont(mockPdf, 12, true, false)
      
      expect(fontManager.isCurrentState(12, false, false)).toBe(false)
    })

    it('should return false for different italic state', () => {
      fontManager.setConsistentFont(mockPdf, 12, false, true)
      
      expect(fontManager.isCurrentState(12, false, false)).toBe(false)
    })
  })

  describe('forceUpdateFont', () => {
    it('should force update even if state appears unchanged', () => {
      // Set initial state
      fontManager.setConsistentFont(mockPdf, 12, false, false)
      mockPdf.setFontSize.mockClear()
      mockPdf.setFont.mockClear()
      
      // Force update with same parameters
      fontManager.forceUpdateFont(mockPdf, 12, false, false)
      
      // Should have called PDF methods despite same parameters
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(12)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'normal')
    })

    it('should update internal state correctly', () => {
      fontManager.forceUpdateFont(mockPdf, 16, true, true)
      
      const state = fontManager.getCurrentFontState()
      expect(state).toEqual({
        family: 'times',
        size: 16,
        style: 'bolditalic'
      })
    })
  })
})

describe('Factory functions', () => {
  describe('createFontManager', () => {
    it('should create a PDFFontManager instance', () => {
      const fontManager = createFontManager()
      expect(fontManager).toBeInstanceOf(PDFFontManager)
    })

    it('should create a working font manager', () => {
      const fontManager = createFontManager()
      const state = fontManager.getCurrentFontState()
      
      expect(state.family).toBe('times')
      expect(state.size).toBe(11)
      expect(state.style).toBe('normal')
    })
  })

  describe('applyConsistentFont', () => {
    let mockPdf: any

    beforeEach(() => {
      mockPdf = {
        setFontSize: vi.fn(),
        setFont: vi.fn()
      }
    })

    it('should apply normal font by default', () => {
      applyConsistentFont(mockPdf, 12)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(12)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'normal')
    })

    it('should apply bold font when specified', () => {
      applyConsistentFont(mockPdf, 14, true, false)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(14)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bold')
    })

    it('should apply italic font when specified', () => {
      applyConsistentFont(mockPdf, 10, false, true)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(10)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'italic')
    })

    it('should apply bold italic font when both specified', () => {
      applyConsistentFont(mockPdf, 16, true, true)
      
      expect(mockPdf.setFontSize).toHaveBeenCalledWith(16)
      expect(mockPdf.setFont).toHaveBeenCalledWith('times', 'bolditalic')
    })
  })
})

describe('Font state transitions', () => {
  let fontManager: PDFFontManager
  let mockPdf: any

  beforeEach(() => {
    fontManager = new PDFFontManager()
    mockPdf = {
      setFontSize: vi.fn(),
      setFont: vi.fn()
    }
  })

  it('should handle complex font state transitions', () => {
    // Start with normal
    fontManager.setConsistentFont(mockPdf, 12, false, false)
    expect(fontManager.getCurrentFontState().style).toBe('normal')
    
    // Change to bold
    fontManager.setConsistentFont(mockPdf, 12, true, false)
    expect(fontManager.getCurrentFontState().style).toBe('bold')
    
    // Change to italic
    fontManager.setConsistentFont(mockPdf, 12, false, true)
    expect(fontManager.getCurrentFontState().style).toBe('italic')
    
    // Change to bold italic
    fontManager.setConsistentFont(mockPdf, 12, true, true)
    expect(fontManager.getCurrentFontState().style).toBe('bolditalic')
    
    // Back to normal
    fontManager.setConsistentFont(mockPdf, 12, false, false)
    expect(fontManager.getCurrentFontState().style).toBe('normal')
  })

  it('should handle font size changes with style preservation', () => {
    // Set bold font
    fontManager.setConsistentFont(mockPdf, 12, true, false)
    expect(fontManager.getCurrentFontState()).toEqual({
      family: 'times',
      size: 12,
      style: 'bold'
    })
    
    // Change size while keeping bold
    fontManager.setConsistentFont(mockPdf, 16, true, false)
    expect(fontManager.getCurrentFontState()).toEqual({
      family: 'times',
      size: 16,
      style: 'bold'
    })
  })

  it('should prevent unnecessary PDF operations during repeated calls', () => {
    // Set initial state
    fontManager.setConsistentFont(mockPdf, 12, true, false)
    const initialCalls = mockPdf.setFont.mock.calls.length
    
    // Call multiple times with same parameters
    fontManager.setConsistentFont(mockPdf, 12, true, false)
    fontManager.setConsistentFont(mockPdf, 12, true, false)
    fontManager.setConsistentFont(mockPdf, 12, true, false)
    
    // Should not have made additional calls
    expect(mockPdf.setFont.mock.calls.length).toBe(initialCalls)
  })
})