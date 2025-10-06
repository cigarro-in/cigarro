import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { supabase } from '../../utils/supabase/client';

interface HeroSlide {
  id: string;
  title: string;
  suptitle?: string;
  description?: string;
  image_url: string;
  mobile_image_url?: string;
  small_image_url?: string;
  button_text?: string;
  button_url?: string;
  product_name?: string;
  product_price?: string;
  product_image_url?: string;
  is_active: boolean;
  sort_order: number;
}

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slides, setSlides] = useState<HeroSlide[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadHeroSlides();
  }, []);

  const loadHeroSlides = async () => {
    try {
      const { data, error } = await supabase
        .from('hero_slides')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) throw error;
      setSlides(data || []);
    } catch (error) {
      console.error('Error loading hero slides:', error);
      // No fallback - show empty state if database fails
      setSlides([]);
    } finally {
      setIsLoading(false);
    }
  };

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length);
  };

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
  };

  const currentSlideData = slides[currentSlide];

  if (isLoading) {
    return (
      <div className="pt-[var(--gutter)] pb-[var(--gutter)] relative h-screen flex items-center overflow-hidden">
        <div className="main-container h-full relative z-10">
          <div className="flex items-center justify-center h-full">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-dark"></div>
          </div>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="pt-4 pb-4 sm:pt-8 sm:pb-8 relative h-screen flex items-center overflow-hidden">
      {/* Animated Background Elements */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-2 h-2 bg-sunflower rounded-full animate-pulse opacity-60"></div>
        <div className="absolute top-40 right-32 w-1 h-1 bg-canyon rounded-full animate-pulse opacity-40" style={{ animationDelay: '1s' }}></div>
        <div className="absolute bottom-32 left-40 w-3 h-3 bg-sunflower rounded-full animate-pulse opacity-50" style={{ animationDelay: '2s' }}></div>
        <div className="absolute bottom-20 right-20 w-1.5 h-1.5 bg-canyon rounded-full animate-pulse opacity-60" style={{ animationDelay: '0.5s' }}></div>
      </div>

      <div className="container mx-auto px-4 h-full relative z-10">
        <div className="relative h-full">
          <div className="relative h-full">
            <div className="relative h-full">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 lg:gap-16 h-full" id={`header-slider__slide-${currentSlide}`}>
                
                {/* Big Image */}
                <div className="relative bg-transparent overflow-hidden rounded-lg h-full">
                  <div className="relative h-full">
                    <img 
                      className="hidden md:block w-full h-full object-cover" 
                      src={currentSlideData.image_url} 
                      alt={`Slide ${currentSlide + 1}`}
                      width="1440" 
                      height="1491"
                    />
                    <img 
                      className="block md:hidden w-full h-full object-cover" 
                      src={currentSlideData.mobile_image_url || currentSlideData.image_url} 
                      alt={`Slide ${currentSlide + 1}`}
                      width="674" 
                      height="870"
                    />
                  </div>

                  {/* Product Button (if exists) */}
                  {currentSlideData.product_name && currentSlideData.product_image_url && (
                    <div className="absolute bottom-4 left-4 bg-white rounded-lg overflow-hidden max-w-[100px] max-h-[100px] md:max-w-[calc(100%-2rem)] md:max-h-[165px] whitespace-nowrap text-ellipsis transition-all duration-1000 ease-[cubic-bezier(0.33,1,0.68,1)] hover:max-w-[calc(100%-2rem)] hover:max-h-[165px] group">
                      <div className="box-border">
                        <div className="flex flex-nowrap items-center max-w-full">
                          <div className="block my-2.5 mx-2.5 min-w-[80px] max-w-[80px] aspect-square rounded-lg overflow-hidden text-center">
                            <img 
                              className="w-full mx-auto object-cover aspect-square" 
                              src={currentSlideData.product_image_url} 
                              alt="" 
                              width="400" 
                              height="400"
                            />
                          </div>
                          <div className="my-2 mr-2.5 ml-0 max-w-[calc(100%-110px)]">
                            <div className="block text-dark font-sans font-medium text-base lg:text-lg leading-tight tracking-tight mb-0.5 overflow-hidden whitespace-nowrap text-ellipsis max-w-max">
                              {currentSlideData.product_name}
                            </div>
                            <div className="text-dark font-sans text-sm lg:text-base">
                              {currentSlideData.product_price}
                            </div>
                          </div>
                          <a 
                            href={`/product/${currentSlideData.product_name?.toLowerCase().replace(/\s+/g, '-')}`} 
                            className="hidden group-hover:block inline-block w-10 aspect-square border border-dark rounded-full relative transition-colors duration-300 overflow-hidden ml-auto mr-2.5"
                          >
                            <span className="inline-block w-full h-full relative -top-px -left-px transition-transform duration-500">
                              <ChevronRight className="w-4 h-4 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                            </span>
                          </a>
                        </div>
                        <div className="hidden group-hover:flex flex-nowrap text-center border-t border-coyote text-sm lg:text-base">
                          <a 
                            href={`/product/${currentSlideData.product_name?.toLowerCase().replace(/\s+/g, '-')}`}
                            className="flex-1 py-4 px-6 text-inherit text-sm leading-none w-1/2 cursor-pointer transition-all duration-500 hover:bg-creme-light"
                          >
                            Customize
                          </a>
                          <button 
                            type="button"
                            className="flex-1 py-4 px-6 text-inherit text-sm leading-none w-1/2 cursor-pointer transition-all duration-500 border-l border-coyote hover:bg-creme-light"
                          >
                            Add to cart
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Content */}
                <div className="flex flex-col justify-between h-full">
                  <div className="pt-8 pb-4 sm:pt-16 sm:pb-8 lg:pb-16 fade-in">
                    {currentSlideData.suptitle && (
                      <div className="suptitle text-canyon overflow-hidden w-full mb-3 sm:mb-5">
                        <p className="suptitle text-sm sm:text-base lg:text-lg">{currentSlideData.suptitle}</p>
                      </div>
                    )}
                    <div className="mb-8 sm:mb-16 lg:mb-8">
                      <h2 className="medium-title w-full leading-tight text-2xl sm:text-3xl lg:text-4xl xl:text-5xl">{currentSlideData.title}</h2>
                    </div>
                    {currentSlideData.button_text && currentSlideData.button_url && (
                      <a
                        href={currentSlideData.button_url}
                        className="inline-block font-sans font-normal text-creme-light bg-dark border-none rounded-full text-center relative min-w-[90px] no-underline overflow-hidden cursor-pointer uppercase tracking-wide text-sm sm:text-base leading-[1.71] px-4 sm:px-6 lg:px-8 py-2 sm:py-3 lg:py-4 transition-all duration-500 delay-300 lg:absolute lg:bottom-32 hover:bg-creme-light hover:text-dark"
                        target="_self"
                      >
                        <span className="block transition-transform duration-500 py-1 sm:py-2 lg:py-4">
                          {currentSlideData.button_text}
                        </span>
                      </a>
                    )}
                  </div>

                  {/* Small Image */}
                  {currentSlideData.small_image_url && (
                    <div className="hidden lg:block w-full h-72 bg-transparent relative overflow-hidden rounded-lg">
                      <div className="relative h-full">
                        <img 
                          className="w-full h-full object-cover" 
                          src={currentSlideData.small_image_url} 
                          alt={`Detail ${currentSlide + 1}`}
                          width="1440" 
                          height="726"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

            {/* Navigation Arrows */}
            <div className="hidden lg:flex absolute right-0 bottom-72 z-10 space-x-1">
              <button 
                className="inline-block w-10 lg:w-12 aspect-square border border-dark rounded-full relative transition-colors duration-300 overflow-hidden hover:bg-dark hover:text-white group"
                onClick={prevSlide}
              >
                <span className="inline-block w-full h-full relative transition-transform duration-500 group-hover:translate-x-full">
                  <ChevronLeft className="w-5 h-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </span>
                <span className="inline-block w-full h-full absolute left-0 top-0 transition-transform duration-500 transform -translate-x-full group-hover:translate-x-0">
                  <ChevronLeft className="w-5 h-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white" />
                </span>
              </button>
              <button 
                className="inline-block w-10 lg:w-12 aspect-square border border-dark rounded-full relative transition-colors duration-300 overflow-hidden hover:bg-dark hover:text-white group"
                onClick={nextSlide}
              >
                <span className="inline-block w-full h-full relative transition-transform duration-500 group-hover:translate-x-full">
                  <ChevronRight className="w-5 h-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
                </span>
                <span className="inline-block w-full h-full absolute left-0 top-0 transition-transform duration-500 transform -translate-x-full group-hover:translate-x-0">
                  <ChevronRight className="w-5 h-5 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white" />
                </span>
              </button>
            </div>

            {/* Slide Indicators */}
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 flex space-x-2 lg:hidden">
              {slides.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentSlide(index)}
                  className={`h-2 rounded-full transition-all duration-300 ${
                    index === currentSlide 
                      ? 'w-8 bg-dark' 
                      : 'w-2 bg-dark/30 hover:bg-dark/60'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
  );
};

export default Hero;
