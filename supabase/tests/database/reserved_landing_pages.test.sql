begin;
create extension if not exists pgtap with schema extensions;
select plan(3);

select is(public.handle_available('car-detailing-booking-app'), false, 'car-detailing-booking-app is reserved');
select is(public.handle_available('ai-detailing-quote-calculator'), false, 'ai-detailing-quote-calculator is reserved');
select is(public.handle_available('booking-link-with-deposits'), false, 'booking-link-with-deposits is reserved');

select * from finish();
rollback;
