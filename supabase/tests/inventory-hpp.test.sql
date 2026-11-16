-- Deterministic unit checks for the moving-average formula.
-- Run only against a local Supabase database or isolated staging project
-- after inventory-hpp-moving-average.sql has been applied.
do $inventory_hpp_tests$
declare
  v_result numeric(14,2);
begin
  v_result := public.calculate_moving_average_cost(100,10000,50,12000);
  if v_result <> 10666.67 then
    raise exception 'Test 1 failed: expected 10666.67, got %',v_result;
  end if;

  v_result := public.calculate_moving_average_cost(0,0,5,12500);
  if v_result <> 12500.00 then
    raise exception 'Test 2 failed: expected 12500.00, got %',v_result;
  end if;

  v_result := public.calculate_moving_average_cost(2.5,20000,1.5,25000);
  if v_result <> 21875.00 then
    raise exception 'Test 3 failed: expected 21875.00, got %',v_result;
  end if;

  v_result := public.calculate_moving_average_cost(10,10000,1,11000);
  if v_result <> 10090.91 then
    raise exception 'Test 4 failed: expected 10090.91, got %',v_result;
  end if;

  begin
    perform public.calculate_moving_average_cost(-1,10000,1,12000);
    raise exception 'Test 5 failed: negative opening quantity was accepted';
  exception
    when others then
      if sqlerrm = 'Test 5 failed: negative opening quantity was accepted' then raise; end if;
  end;
end;
$inventory_hpp_tests$;

select 'Moving Average HPP unit checks passed' as result;
